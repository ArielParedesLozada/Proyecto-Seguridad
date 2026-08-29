using Backend.Data.Database;
using Backend.Domain.Enums;
using Backend.Domain.Models;
using Backend.Presentation.Dtos.Requests;
using Backend.Presentation.Dtos.Responses;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Projects;

public class ProjectService(AppDatabase database)
{
    private readonly AppDatabase _database = database;

    public IAsyncEnumerable<ProjectResponse> GetProjectsAsync(Guid userId, bool archived) => _database.ProjectMembers
        .AsNoTracking()
        .Where(member => member.UserId == userId && member.Project.IsArchived == archived)
        .OrderByDescending(member => member.Project.UpdatedAt)
        .Select(member => new ProjectResponse
        {
            Id = member.Project.Id,
            Name = member.Project.Name,
            OwnerName = member.Project.Owner.Nombre,
            Role = member.Role == Roles.Owner
                ? "OWNER"
                : member.Role == Roles.Editor ? "EDITOR" : "VIEWER",
            CreatedAt = member.Project.CreatedAt,
            UpdatedAt = member.Project.UpdatedAt,
            IsArchived = member.Project.IsArchived,
        })
        .AsAsyncEnumerable();

    public Task<ProjectResponse?> GetProjectAsync(Guid projectId, Guid userId) => _database.ProjectMembers
        .AsNoTracking()
        .Where(member => member.ProjectId == projectId && member.UserId == userId)
        .Select(member => new ProjectResponse
        {
            Id = member.Project.Id,
            Name = member.Project.Name,
            OwnerName = member.Project.Owner.Nombre,
            Role = member.Role == Roles.Owner
                ? "OWNER"
                : member.Role == Roles.Editor ? "EDITOR" : "VIEWER",
            CreatedAt = member.Project.CreatedAt,
            UpdatedAt = member.Project.UpdatedAt,
            IsArchived = member.Project.IsArchived,
        })
        .SingleOrDefaultAsync();

    public Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request) =>
        CreateOwnedProjectAsync(userId, request.Name);

    public async Task<ProjectResponse?> UpdateProjectAsync(Guid projectId, Guid userId, UpdateProjectRequest request)
    {
        EnsureName(request.Name);
        var project = await GetOwnedProjectAsync(projectId, userId);
        if (project is null)
            return null;

        project.Name = request.Name;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        return await ToOwnerResponseAsync(project);
    }

    public async Task<bool> ArchiveProjectAsync(Guid projectId, Guid userId)
    {
        var project = await GetOwnedProjectAsync(projectId, userId);
        if (project is null)
            return false;

        project.IsArchived = true;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        return true;
    }

    public async Task<ProjectResponse?> CopyProjectAsync(Guid sourceProjectId, Guid userId)
    {
        var sourceName = await _database.ProjectMembers
            .AsNoTracking()
            .Where(member => member.ProjectId == sourceProjectId && member.UserId == userId)
            .Select(member => member.Project.Name)
            .SingleOrDefaultAsync();
        return sourceName is null ? null : await CreateOwnedProjectAsync(userId, $"{sourceName} - Copia");
    }

    private async Task<ProjectResponse> CreateOwnedProjectAsync(Guid userId, string name)
    {
        EnsureName(name);
        var ownerName = await _database.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.Nombre)
            .SingleOrDefaultAsync()
            ?? throw new InvalidOperationException("El usuario autenticado no existe.");

        await using var transaction = await _database.Database.BeginTransactionAsync();
        var project = new Project(name, userId);
        _database.Projects.Add(project);
        _database.ProjectMembers.Add(new ProjectMember(project.Id, userId, Roles.Owner));
        await _database.SaveChangesAsync();
        await transaction.CommitAsync();

        return new ProjectResponse
        {
            Id = project.Id,
            Name = project.Name,
            OwnerName = ownerName,
            Role = "OWNER",
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt,
            IsArchived = project.IsArchived,
        };
    }

    private Task<Project?> GetOwnedProjectAsync(Guid projectId, Guid userId) => _database.Projects
        .Where(project => project.Id == projectId
            && project.OwnerId == userId
            && project.Members.Any(member => member.UserId == userId && member.Role == Roles.Owner))
        .SingleOrDefaultAsync();

    private async Task<ProjectResponse> ToOwnerResponseAsync(Project project)
    {
        var ownerName = await _database.Users
            .AsNoTracking()
            .Where(user => user.Id == project.OwnerId)
            .Select(user => user.Nombre)
            .SingleAsync();
        return new ProjectResponse
        {
            Id = project.Id,
            Name = project.Name,
            OwnerName = ownerName,
            Role = "OWNER",
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt,
            IsArchived = project.IsArchived,
        };
    }

    private static void EnsureName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre del proyecto es obligatorio.", nameof(name));
    }
}
