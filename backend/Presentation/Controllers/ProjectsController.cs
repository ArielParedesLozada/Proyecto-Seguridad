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
[Route("projects")]
public class ProjectsController(ProjectService projectService) : ControllerBase
{
    private readonly ProjectService _projectService = projectService;

    [HttpGet]
    public async Task<ActionResult<List<ProjectResponse>>> GetProjects([FromQuery] bool archived = false)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        return Ok(await _projectService.GetProjectsAsync(userId, archived));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetProject(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var project = await _projectService.GetProjectAsync(id, userId);
        return project is null ? Forbid() : Ok(project);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> CreateProject(CreateProjectRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        try
        {
            var project = await _projectService.CreateProjectAsync(userId, request);
            return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> UpdateProject(Guid id, UpdateProjectRequest request)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        try
        {
            var project = await _projectService.UpdateProjectAsync(id, userId, request);
            return project is null ? Forbid() : Ok(project);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> ArchiveProject(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        return await _projectService.ArchiveProjectAsync(id, userId) ? NoContent() : Forbid();
    }

    [HttpPost("{id:guid}/copy")]
    public async Task<ActionResult<ProjectResponse>> CopyProject(Guid id)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var copy = await _projectService.CopyProjectAsync(id, userId);
        return copy is null ? Forbid() : CreatedAtAction(nameof(GetProject), new { id = copy.Id }, copy);
    }

    private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
        User.FindFirstValue(AuthClaimTypes.UserId), out userId);
}
