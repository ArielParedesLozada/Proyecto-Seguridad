using System.ComponentModel.DataAnnotations;

namespace Backend.Presentation.Dtos.Requests;

public class CreateInvitationRequest
{
    [Required] public string Email { get; set; } = string.Empty;
    [Required] public string Role { get; set; } = string.Empty;   // "EDITOR" | "VIEWER"
}
