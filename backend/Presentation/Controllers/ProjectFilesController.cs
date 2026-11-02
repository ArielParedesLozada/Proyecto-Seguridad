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
[Route("projects/{projectId:guid}/files")]
public class ProjectFilesController(ProjectFileService projectFileService) : ControllerBase
{
    private readonly ProjectFileService _projectFileService = projectFileService;

    [HttpGet]
    public async Task<ActionResult<List<ProjectFileTreeResponse>>> GetFiles(Guid projectId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.GetFilesAsync(projectId, userId);
        return result.Status == ProjectFileResultStatus.Success ? Ok(result.Value) : Forbid();
    }

    [HttpGet("{fileId:guid}")]
    public async Task<ActionResult<ProjectFileResponse>> GetFile(Guid projectId, Guid fileId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.GetFileAsync(projectId, fileId, userId);
        return result.Status == ProjectFileResultStatus.Success ? Ok(result.Value) : Forbid();
    }

    [HttpPost]
    public async Task<ActionResult<ProjectFileResponse>> CreateFile(Guid projectId, CreateProjectFileRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.CreateFileAsync(projectId, userId, request);
        return ToActionResult(result, file => CreatedAtAction(nameof(GetFile), new { projectId, fileId = file.Id }, file));
    }

    [HttpPut("{fileId:guid}")]
    public async Task<ActionResult<ProjectFileResponse>> RenameFile(Guid projectId, Guid fileId, UpdateProjectFileRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.RenameFileAsync(projectId, fileId, userId, request);
        return ToActionResult(result, file => Ok(file));
    }

    [HttpPut("{fileId:guid}/content")]
    public async Task<ActionResult<ProjectFileResponse>> UpdateContent(
        Guid projectId, Guid fileId, UpdateProjectFileContentRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.UpdateContentAsync(projectId, fileId, userId, request);
        return ToActionResult(result, file => Ok(file));
    }

    [HttpDelete("{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid projectId, Guid fileId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.DeleteFileAsync(projectId, fileId, userId);
        return result.Status == ProjectFileResultStatus.Success ? NoContent() : Forbid();
    }

    private ActionResult<ProjectFileResponse> ToActionResult(
        ProjectFileResult<ProjectFileResponse> result,
        Func<ProjectFileResponse, ActionResult<ProjectFileResponse>> onSuccess) => result.Status switch
    {
        ProjectFileResultStatus.Success => onSuccess(result.Value!),
        ProjectFileResultStatus.Invalid => BadRequest(new { error = "La solicitud de archivo no es vÃ¡lida." }),
        ProjectFileResultStatus.Conflict => Conflict(new { error = "Ya existe un elemento con ese nombre en esta carpeta." }),
        _ => Forbid(),
    };

    private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
        User.FindFirstValue(AuthClaimTypes.UserId), out userId);
}
