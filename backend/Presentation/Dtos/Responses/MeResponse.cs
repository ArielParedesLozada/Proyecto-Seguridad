namespace Backend.Presentation.Dtos.Responses;

public class MeResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string Nombre { get; set; } = null!;
}
