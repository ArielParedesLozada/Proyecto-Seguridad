namespace Backend.Presentation.Dtos.Responses;

public class InvitationResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;    // "EDITOR" | "VIEWER"
    public string Status { get; set; } = string.Empty;  // "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
