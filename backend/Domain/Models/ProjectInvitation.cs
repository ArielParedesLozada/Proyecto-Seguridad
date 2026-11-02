using Backend.Domain.Enums;

namespace Backend.Domain.Models;

public class ProjectInvitation(
    Guid projectId, string email, Roles role, string tokenHash, Guid invitedById, DateTimeOffset expiresAt)
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; } = projectId;
    /// <summary>Correo del invitado, normalizado a minúsculas.</summary>
    public string Email { get; set; } = email;
    public Roles Role { get; set; } = role;
    /// <summary>SHA-256 en hexadecimal del token. El token en claro nunca se guarda.</summary>
    public string TokenHash { get; set; } = tokenHash;
    public Guid InvitedById { get; set; } = invitedById;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = expiresAt;
    public DateTimeOffset? AcceptedAt { get; set; }
    public Guid? AcceptedByUserId { get; set; }

    public Project Project { get; set; } = null!;
    public User InvitedBy { get; set; } = null!;
}
