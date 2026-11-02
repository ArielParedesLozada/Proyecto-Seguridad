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
    public IActionResult Login([FromQuery] string? returnUrl = null)
    {
        var target = IsSafeReturnUrl(returnUrl) ? returnUrl! : "/projects";
        var properties = new AuthenticationProperties
        {
            RedirectUri = $"{_frontendOptions.BaseUrl}{target}"
        };
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    /// <summary>
    /// Solo se acepta una ruta relativa del propio frontend. Rechaza URLs absolutas
    /// y las que empiezan con "//" o "/\", que los navegadores tratan como
    /// protocol-relative y permitirían un open redirect.
    /// </summary>
    private static bool IsSafeReturnUrl(string? returnUrl) =>
        !string.IsNullOrWhiteSpace(returnUrl)
        && returnUrl.StartsWith('/')
        && !returnUrl.StartsWith("//")
        && !returnUrl.StartsWith("/\\");

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
