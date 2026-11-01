using Backend.App.Auth;
using Backend.Domain.Services;
using Backend.Presentation.Dtos.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Presentation.Controllers;

[ApiController]
[Authorize]
[Route("crypto")]
public class CryptoController(ICipherRegistry cipherRegistry) : ControllerBase
{
    private readonly ICipherRegistry _cipherRegistry = cipherRegistry;

    [HttpGet("session")]
    public IActionResult Session()
    {
        var sessionKey = User.FindFirst(AuthClaimTypes.SessionKey)?.Value;
        if (string.IsNullOrEmpty(sessionKey))
            return Unauthorized();

        var cipher = _cipherRegistry.Current;
        return Ok(new SessionKeyResponse
        {
            Key = sessionKey,
            Algorithm = cipher.Algorithm,
            Version = cipher.Version,
        });
    }
}
