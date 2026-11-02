namespace Backend.Domain.Models;

public class Project(string name, Guid ownerId)
{
    // EF Core no puede enlazar "name" al constructor principal porque la
    // propiedad Name ya no está mapeada (vive cifrada en name_cipher,
    // fuera de este archivo). Este constructor es el que EF usa al leer.
    private Project() : this(string.Empty, Guid.Empty) { }

    public Guid Id { get; set; }
    public string Name { get; set; } = name;
    public Guid OwnerId { get; set; } = ownerId;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsArchived { get; set; }

    public User Owner { get; set; } = null!;
    public ICollection<ProjectMember> Members { get; set; } = [];
    public ICollection<ProjectFile> Files { get; set; } = [];
    public ICollection<ProjectInvitation> Invitations { get; set; } = [];
}
