using System.Security.Claims;
using Backend.App.Auth;
using Backend.App.Projects;
using Backend.Presentation.Dtos.Requests;
using Backend.Presentation.Dtos.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("projects/{projectId:guid}/invitations")]
public class ProjectInvitationsController(ProjectInvitationService invitationService) : ControllerBase
{
    private readonly ProjectInvitationService _invitationService = invitationService;

    [HttpGet]
    public async Task<ActionResult<List<InvitationResponse>>> GetInvitations(Guid projectId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.GetInvitationsAsync(projectId, userId);
        return result.Status == ProjectInvitationResultStatus.Success ? Ok(result.Value) : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Invite(Guid projectId, CreateInvitationRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.InviteAsync(projectId, userId, request);
        return result.Status switch
        {
            ProjectInvitationResultStatus.Success =>
                CreatedAtAction(nameof(GetInvitations), new { projectId }, result.Value),
            ProjectInvitationResultStatus.Forbidden => Forbid(),
            ProjectInvitationResultStatus.Invalid =>
                BadRequest(new { error = "El correo o el rol no son válidos." }),
            ProjectInvitationResultStatus.Conflict =>
                Conflict(new { error = "Ya existe una invitación o una membresía para ese correo." }),
            ProjectInvitationResultStatus.MailFailed =>
                StatusCode(StatusCodes.Status502BadGateway,
                    new { error = "La invitación se creó pero no se pudo enviar el correo." }),
            _ => BadRequest(new { error = "No fue posible completar la operación." }),
        };
    }

    [HttpPost("{invitationId:guid}/resend")]
    public async Task<IActionResult> Resend(Guid projectId, Guid invitationId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.ResendAsync(projectId, invitationId, userId);
        return result.Status switch
        {
            ProjectInvitationResultStatus.Success => Ok(result.Value),
            ProjectInvitationResultStatus.Forbidden => Forbid(),
            ProjectInvitationResultStatus.NotFound =>
                NotFound(new { error = "La invitación no existe." }),
            ProjectInvitationResultStatus.Conflict =>
                Conflict(new { error = "Solo se pueden reenviar invitaciones pendientes." }),
            ProjectInvitationResultStatus.MailFailed =>
                StatusCode(StatusCodes.Status502BadGateway,
                    new { error = "La invitación se creó pero no se pudo enviar el correo." }),
            _ => BadRequest(new { error = "No fue posible completar la operación." }),
        };
    }

    [HttpDelete("{invitationId:guid}")]
    public async Task<IActionResult> Revoke(Guid projectId, Guid invitationId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _invitationService.RevokeAsync(projectId, invitationId, userId);
        return result.Status switch
        {
            ProjectInvitationResultStatus.Success => NoContent(),
            ProjectInvitationResultStatus.Forbidden => Forbid(),
            ProjectInvitationResultStatus.NotFound =>
                NotFound(new { error = "La invitación no existe." }),
            ProjectInvitationResultStatus.Conflict =>
                Conflict(new { error = "Solo se pueden revocar invitaciones pendientes." }),
            _ => BadRequest(new { error = "No fue posible completar la operación." }),
        };
    }

    private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
        User.FindFirstValue(AuthClaimTypes.UserId), out userId);
}
