using Backend.App.Auth;
using Backend.Config;
using Backend.Presentation.Dtos.Responses;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Backend.Presentation.Controllers;

[ApiController]
[Route("auth")]
public class AuthController(
    LogoutService logoutService,
    MeService meService,
    IOptions<FrontendOptions> frontendOptions) : ControllerBase
{
    private readonly LogoutService _logoutService = logoutService;
    private readonly MeService _meService = meService;
    private readonly FrontendOptions _frontendOptions = frontendOptions.Value;

    [HttpGet("login")]
    public IActionResult Login()
    {
        var properties = new AuthenticationProperties
        {
            RedirectUri = $"{_frontendOptions.BaseUrl}/projects"
        };
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeResponse>> Me()
    {
        var user = await _meService.GetCurrentUserAsync(User);
        if (user is null)
            return Unauthorized();
        return Ok(new MeResponse { Id = user.Id, Email = user.Email, Nombre = user.Nombre });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _logoutService.LogoutAsync(HttpContext);
        return NoContent();
    }
}
