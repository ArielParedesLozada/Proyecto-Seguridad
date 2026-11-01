using System.Security.Claims;
using Backend.App.Auth;
using Backend.App.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("invitations")]
public class InvitationsController(ProjectInvitationService invitationService) : ControllerBase
{
    private readonly ProjectInvitationService _invitationService = invitationService;

    [HttpGet("{token}")]
    public async Task<IActionResult> GetInvitation(string token)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.GetByTokenAsync(token, userId);
        return result.Status switch
        {
            ProjectInvitationResultStatus.Success => Ok(result.Value),
            ProjectInvitationResultStatus.NotFound =>
                NotFound(new { error = "La invitación no existe." }),
            ProjectInvitationResultStatus.Expired =>
                StatusCode(StatusCodes.Status410Gone, new { error = "La invitación ya no es válida." }),
            ProjectInvitationResultStatus.EmailMismatch =>
                StatusCode(StatusCodes.Status403Forbidden,
                    new { error = $"Esta invitación es para {result.Value!.Email}." }),
            _ => BadRequest(new { error = "No fue posible completar la operación." }),
        };
    }

    [HttpPost("{token}/accept")]
    public async Task<IActionResult> Accept(string token)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.AcceptAsync(token, userId);
        if (result.Status == ProjectInvitationResultStatus.EmailMismatch)
        {
            var preview = await _invitationService.GetByTokenAsync(token, userId);
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = $"Esta invitación es para {preview.Value?.Email}." });
        }
        return result.Status switch
        {
            ProjectInvitationResultStatus.Success => Ok(result.Value),
            ProjectInvitationResultStatus.NotFound =>
                NotFound(new { error = "La invitación no existe." }),
            ProjectInvitationResultStatus.Expired =>
                StatusCode(StatusCodes.Status410Gone, new { error = "La invitación ya no es válida." }),
            _ => BadRequest(new { error = "No fue posible completar la operación." }),
        };
    }

    private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
        User.FindFirstValue(AuthClaimTypes.UserId), out userId);
}
