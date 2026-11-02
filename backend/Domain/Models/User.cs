namespace Backend.Domain.Models;

public class User(string email, string nombre, string googleId)
{
    public Guid Id { get; set; }
    public string Email { get; set; } = email;
    public string Nombre { get; set; } = nombre;
    public string GoogleId { get; set; } = googleId;
    public ICollection<Project> OwnedProjects { get; set; } = [];
    public ICollection<ProjectMember> ProjectMemberships { get; set; } = [];
}
