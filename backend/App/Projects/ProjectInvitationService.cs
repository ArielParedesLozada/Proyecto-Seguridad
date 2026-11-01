using System.Net;
using System.Security.Cryptography;
using Backend.Config;
using Backend.Data.Database;
using Backend.Domain.Enums;
using Backend.Domain.Models;
using Backend.Domain.Services;
using Backend.Presentation.Dtos.Requests;
using Backend.Presentation.Dtos.Responses;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Backend.App.Projects;

public enum ProjectInvitationResultStatus
{
    Success,
    Forbidden,      // no es dueño, o el proyecto está archivado
    Invalid,        // correo mal formado, rol no permitido
    Conflict,       // ya es miembro, o ya hay una invitación pendiente
    NotFound,       // token inexistente
    Expired,        // token vencido o ya usado/revocado
    EmailMismatch,  // el token no corresponde al correo de la sesión
    MailFailed,     // la invitación se creó pero el SMTP falló
}

public record ProjectInvitationResult<T>(ProjectInvitationResultStatus Status, T? Value = default);

public class ProjectInvitationService(
    AppDatabase database, INotifier notifier, IOptions<FrontendOptions> frontendOptions, ILogger<ProjectInvitationService> logger)
{
    private readonly AppDatabase _database = database;
    private readonly INotifier _notifier = notifier;
    private readonly FrontendOptions _frontendOptions = frontendOptions.Value;
    private readonly ILogger<ProjectInvitationService> _logger = logger;

    public async Task<ProjectInvitationResult<InvitationResponse>> InviteAsync(
        Guid projectId, Guid userId, CreateInvitationRequest request)
    {
        var project = await _database.Projects
            .Where(project => project.Id == projectId
                && project.OwnerId == userId
                && !project.IsArchived
                && project.Members.Any(member => member.UserId == userId && member.Role == Roles.Owner))
            .SingleOrDefaultAsync();
        if (project is null)
            return new(ProjectInvitationResultStatus.Forbidden);

        var email = request.Email.Trim().ToLowerInvariant();
        if (!MailboxAddress.TryParse(email, out _))
            return new(ProjectInvitationResultStatus.Invalid);

        if (!TryParseInvitableRole(request.Role, out var role))
            return new(ProjectInvitationResultStatus.Invalid);

        var ownerEmail = await GetUserEmailAsync(userId);
        if (string.Equals(email, ownerEmail, StringComparison.OrdinalIgnoreCase))
            return new(ProjectInvitationResultStatus.Conflict);

        var alreadyMember = await _database.ProjectMembers
            .AnyAsync(member => member.ProjectId == projectId && member.User.Email.ToLower() == email);
        if (alreadyMember)
            return new(ProjectInvitationResultStatus.Conflict);

        var now = DateTimeOffset.UtcNow;
        var hasPendingInvitation = await _database.ProjectInvitations
            .AnyAsync(invitation => invitation.ProjectId == projectId
                && invitation.Email == email
                && invitation.Status == InvitationStatus.Pending
                && invitation.ExpiresAt >= now);
        if (hasPendingInvitation)
            return new(ProjectInvitationResultStatus.Conflict);

        var token = GenerateToken();
        var newInvitation = new ProjectInvitation(projectId, email, role, HashToken(token), userId, now.AddDays(7));
        _database.ProjectInvitations.Add(newInvitation);
        await _database.SaveChangesAsync();

        var response = ToResponse(newInvitation);
        try
        {
            var inviterName = await GetUserNameAsync(userId);
            var link = $"{_frontendOptions.BaseUrl}/invitations/{token}";
            var body = BuildInvitationBody(project.Name, inviterName, role, link);
            await _notifier.SendAsync(email, $"Invitación para colaborar en {project.Name}", body);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "No se pudo enviar el correo de la invitación {InvitationId}", newInvitation.Id);
            return new(ProjectInvitationResultStatus.MailFailed, response);
        }

        return new(ProjectInvitationResultStatus.Success, response);
    }

    public async Task<ProjectInvitationResult<List<InvitationResponse>>> GetInvitationsAsync(Guid projectId, Guid userId)
    {
        if (!await IsOwnerAsync(projectId, userId))
            return new(ProjectInvitationResultStatus.Forbidden);

        var now = DateTimeOffset.UtcNow;
        var invitations = await _database.ProjectInvitations
            .AsNoTracking()
            .Where(invitation => invitation.ProjectId == projectId)
            .OrderByDescending(invitation => invitation.CreatedAt)
            .Select(invitation => new InvitationResponse
            {
                Id = invitation.Id,
                Email = invitation.Email,
                Role = invitation.Role == Roles.Editor ? "EDITOR" : "VIEWER",
                Status = invitation.Status == InvitationStatus.Pending && invitation.ExpiresAt < now
                    ? "EXPIRED"
                    : invitation.Status == InvitationStatus.Accepted ? "ACCEPTED"
                    : invitation.Status == InvitationStatus.Revoked ? "REVOKED"
                    : "PENDING",
                CreatedAt = invitation.CreatedAt,
                ExpiresAt = invitation.ExpiresAt,
            })
            .ToListAsync();

        return new(ProjectInvitationResultStatus.Success, invitations);
    }

    public async Task<ProjectInvitationResult<object>> RevokeAsync(Guid projectId, Guid invitationId, Guid userId)
    {
        if (!await IsOwnerAsync(projectId, userId))
            return new(ProjectInvitationResultStatus.Forbidden);

        var invitation = await _database.ProjectInvitations
            .SingleOrDefaultAsync(invitation => invitation.Id == invitationId && invitation.ProjectId == projectId);
        if (invitation is null)
            return new(ProjectInvitationResultStatus.NotFound);
        if (invitation.Status != InvitationStatus.Pending)
            return new(ProjectInvitationResultStatus.Conflict);

        invitation.Status = InvitationStatus.Revoked;
        await _database.SaveChangesAsync();
        return new(ProjectInvitationResultStatus.Success);
    }

    public async Task<ProjectInvitationResult<InvitationResponse>> ResendAsync(Guid projectId, Guid invitationId, Guid userId)
    {
        if (!await IsOwnerAsync(projectId, userId))
            return new(ProjectInvitationResultStatus.Forbidden);

        var invitation = await _database.ProjectInvitations
            .Include(invitation => invitation.Project)
            .SingleOrDefaultAsync(invitation => invitation.Id == invitationId && invitation.ProjectId == projectId);
        if (invitation is null)
            return new(ProjectInvitationResultStatus.NotFound);
        if (invitation.Status != InvitationStatus.Pending)
            return new(ProjectInvitationResultStatus.Conflict);

        var token = GenerateToken();
        invitation.TokenHash = HashToken(token);
        invitation.ExpiresAt = DateTimeOffset.UtcNow.AddDays(7);
        await _database.SaveChangesAsync();

        var response = ToResponse(invitation);
        try
        {
            var inviterName = await GetUserNameAsync(userId);
            var link = $"{_frontendOptions.BaseUrl}/invitations/{token}";
            var body = BuildInvitationBody(invitation.Project.Name, inviterName, invitation.Role, link);
            await _notifier.SendAsync(invitation.Email, $"Invitación para colaborar en {invitation.Project.Name}", body);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "No se pudo reenviar el correo de la invitación {InvitationId}", invitation.Id);
            return new(ProjectInvitationResultStatus.MailFailed, response);
        }

        return new(ProjectInvitationResultStatus.Success, response);
    }

    public async Task<ProjectInvitationResult<InvitationPreviewResponse>> GetByTokenAsync(string token, Guid userId)
    {
        var invitation = await FindInvitationAsync(token);
        if (invitation is null)
            return new(ProjectInvitationResultStatus.NotFound);

        if (IsExpiredOrRevoked(invitation))
            return new(ProjectInvitationResultStatus.Expired);

        if (invitation.Status == InvitationStatus.Accepted)
            return new(ProjectInvitationResultStatus.Success, ToPreview(invitation, "ACCEPTED"));

        var userEmail = await GetUserEmailAsync(userId);
        if (!string.Equals(userEmail, invitation.Email, StringComparison.OrdinalIgnoreCase))
            return new(ProjectInvitationResultStatus.EmailMismatch, ToPreview(invitation, "PENDING"));

        return new(ProjectInvitationResultStatus.Success, ToPreview(invitation, "PENDING"));
    }

    public async Task<ProjectInvitationResult<AcceptInvitationResponse>> AcceptAsync(string token, Guid userId)
    {
        var invitation = await FindInvitationAsync(token);
        if (invitation is null)
            return new(ProjectInvitationResultStatus.NotFound);

        if (IsExpiredOrRevoked(invitation))
            return new(ProjectInvitationResultStatus.Expired);

        if (invitation.Status != InvitationStatus.Accepted)
        {
            var userEmail = await GetUserEmailAsync(userId);
            if (!string.Equals(userEmail, invitation.Email, StringComparison.OrdinalIgnoreCase))
                return new(ProjectInvitationResultStatus.EmailMismatch);
        }

        var alreadyMember = await _database.ProjectMembers
            .AnyAsync(member => member.ProjectId == invitation.ProjectId && member.UserId == userId);
        if (alreadyMember)
        {
            if (invitation.Status != InvitationStatus.Accepted)
            {
                invitation.Status = InvitationStatus.Accepted;
                invitation.AcceptedAt = DateTimeOffset.UtcNow;
                invitation.AcceptedByUserId = userId;
                await _database.SaveChangesAsync();
            }
            return new(ProjectInvitationResultStatus.Success, ToAcceptResponse(invitation));
        }

        await using var transaction = await _database.Database.BeginTransactionAsync();
        _database.ProjectMembers.Add(new ProjectMember(invitation.ProjectId, userId, invitation.Role));
        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        invitation.AcceptedByUserId = userId;
        invitation.Project.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        await transaction.CommitAsync();

        return new(ProjectInvitationResultStatus.Success, ToAcceptResponse(invitation));
    }

    private static bool IsExpiredOrRevoked(ProjectInvitation invitation) =>
        invitation.Status == InvitationStatus.Revoked
        || (invitation.Status == InvitationStatus.Pending && invitation.ExpiresAt < DateTimeOffset.UtcNow);

    private Task<bool> IsOwnerAsync(Guid projectId, Guid userId) => _database.Projects
        .AnyAsync(project => project.Id == projectId
            && project.OwnerId == userId
            && project.Members.Any(member => member.UserId == userId && member.Role == Roles.Owner));

    private Task<ProjectInvitation?> FindInvitationAsync(string token)
    {
        var tokenHash = HashToken(token);
        return _database.ProjectInvitations
            .Include(invitation => invitation.Project)
            .Include(invitation => invitation.InvitedBy)
            .SingleOrDefaultAsync(invitation => invitation.TokenHash == tokenHash);
    }

    private async Task<string> GetUserNameAsync(Guid userId) => await _database.Users
        .AsNoTracking()
        .Where(user => user.Id == userId)
        .Select(user => user.Nombre)
        .SingleOrDefaultAsync()
        ?? throw new InvalidOperationException("El usuario autenticado no existe.");

    private async Task<string> GetUserEmailAsync(Guid userId) => await _database.Users
        .AsNoTracking()
        .Where(user => user.Id == userId)
        .Select(user => user.Email)
        .SingleOrDefaultAsync()
        ?? throw new InvalidOperationException("El usuario autenticado no existe.");

    private static bool TryParseInvitableRole(string roleText, out Roles role)
    {
        if (string.Equals(roleText, "EDITOR", StringComparison.OrdinalIgnoreCase))
        {
            role = Roles.Editor;
            return true;
        }
        if (string.Equals(roleText, "VIEWER", StringComparison.OrdinalIgnoreCase))
        {
            role = Roles.Viewer;
            return true;
        }
        role = default;
        return false;
    }

    private static string RoleToString(Roles role) => role == Roles.Editor ? "EDITOR" : "VIEWER";

    private static InvitationResponse ToResponse(ProjectInvitation invitation) => new()
    {
        Id = invitation.Id,
        Email = invitation.Email,
        Role = RoleToString(invitation.Role),
        Status = invitation.Status == InvitationStatus.Pending && invitation.ExpiresAt < DateTimeOffset.UtcNow
            ? "EXPIRED"
            : invitation.Status.ToString().ToUpperInvariant(),
        CreatedAt = invitation.CreatedAt,
        ExpiresAt = invitation.ExpiresAt,
    };

    private static InvitationPreviewResponse ToPreview(ProjectInvitation invitation, string status) => new()
    {
        ProjectName = invitation.Project.Name,
        InvitedByName = invitation.InvitedBy.Nombre,
        Email = invitation.Email,
        Role = RoleToString(invitation.Role),
        Status = status,
    };

    private static AcceptInvitationResponse ToAcceptResponse(ProjectInvitation invitation) => new()
    {
        ProjectId = invitation.ProjectId,
        ProjectName = invitation.Project.Name,
        Role = RoleToString(invitation.Role),
    };

    private static string GenerateToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static string BuildInvitationBody(string projectName, string inviterName, Roles role, string link)
    {
        var roleText = role == Roles.Editor ? "editar" : "ver";
        var safeProjectName = WebUtility.HtmlEncode(projectName);
        var safeInviterName = WebUtility.HtmlEncode(inviterName);
        return $@"
        <h3>Te invitaron a un proyecto</h3>
        <p><strong>{safeInviterName}</strong> te invitó a <strong>{safeProjectName}</strong>
           con permiso para <strong>{roleText}</strong>.</p>
        <p><a href='{link}'>Aceptar la invitación</a></p>
        <p><small>El enlace caduca en 7 días. Si no esperabas este correo, ignóralo.</small></p>
        ";
    }
}
