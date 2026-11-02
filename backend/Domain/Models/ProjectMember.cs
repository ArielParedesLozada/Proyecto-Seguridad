using Backend.Domain.Enums;

namespace Backend.Domain.Models;

public class ProjectMember(Guid projectId, Guid userId, Roles role)
{
    public Guid ProjectId { get; set; } = projectId;
    public Guid UserId { get; set; } = userId;
    public Roles Role { get; set; } = role;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    public Project Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
