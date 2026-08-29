using Backend.Domain.Enums;

namespace Backend.Domain.Models;

public class ProjectFile(string name, ProjectFileType type, Guid projectId, Guid? parentId)
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; } = projectId;
    public Guid? ParentId { get; set; } = parentId;
    public string Name { get; set; } = name;
    public ProjectFileType Type { get; set; } = type;
    public string? Content { get; set; } = type == ProjectFileType.File ? string.Empty : null;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Project Project { get; set; } = null!;
    public ProjectFile? Parent { get; set; }
    public ICollection<ProjectFile> Children { get; set; } = [];
}
