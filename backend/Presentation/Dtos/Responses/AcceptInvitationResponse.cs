namespace Backend.Presentation.Dtos.Responses;

public class AcceptInvitationResponse
{
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
