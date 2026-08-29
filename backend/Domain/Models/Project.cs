namespace Backend.Domain.Models;

public class Project(string name, Guid ownerId)
{
    public Guid Id { get; set; }
    public string Name { get; set; } = name;
    public Guid OwnerId { get; set; } = ownerId;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsArchived { get; set; }

    public User Owner { get; set; } = null!;
    public ICollection<ProjectMember> Members { get; set; } = [];
}
