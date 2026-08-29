using System.Security.Claims;
using Backend.App.Auth;
using Backend.App.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("projects/{projectId:guid}/compile")]
public class ProjectCompilationController(
    ProjectCompilationService projectCompilationService,
    ILogger<ProjectCompilationController> logger) : ControllerBase
{
    private readonly ProjectCompilationService _projectCompilationService = projectCompilationService;
    private readonly ILogger<ProjectCompilationController> _logger = logger;

    [HttpPost]
    public async Task<IActionResult> Compile(Guid projectId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(AuthClaimTypes.UserId), out var userId))
            return Unauthorized();

        try
        {
            var result = await _projectCompilationService.CompileAsync(projectId, userId, cancellationToken);
            return result.Status switch
            {
                ProjectCompilationStatus.Success => File(result.Pdf!, "application/pdf", "document.pdf"),
                ProjectCompilationStatus.MainFileNotFound => UnprocessableEntity(new { error = "El proyecto no tiene un archivo principal main.md." }),
                _ => Forbid(),
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return new EmptyResult();
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unable to generate the PDF for project {ProjectId}", projectId);
            return Problem(statusCode: StatusCodes.Status422UnprocessableEntity, title: "No fue posible generar el PDF.");
        }
    }
}
