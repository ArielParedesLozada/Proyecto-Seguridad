namespace Backend.Presentation.Dtos.Responses;

public class InvitationPreviewResponse
{
    public string ProjectName { get; set; } = string.Empty;
    public string InvitedByName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;   // a quién va dirigida
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
