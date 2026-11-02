using System.Text;
using System.Text.Json;
using Backend.App.Auth;
using Backend.Domain.Services;
using Backend.Presentation.Dtos;

namespace Backend.Presentation.Middleware;

public class CryptoEnvelopeMiddleware(RequestDelegate next, ICipherRegistry cipherRegistry, ILogger<CryptoEnvelopeMiddleware> logger)
{
    private static readonly string[] ExemptPrefixes = ["/auth", "/crypto/session", "/swagger"];

    private readonly RequestDelegate _next = next;
    private readonly ICipherRegistry _cipherRegistry = cipherRegistry;
    private readonly ILogger<CryptoEnvelopeMiddleware> _logger = logger;

    public async Task InvokeAsync(HttpContext context)
    {
        if (IsExempt(context.Request.Path))
        {
            await _next(context);
            return;
        }

        var sessionKeyBase64 = context.User.FindFirst(AuthClaimTypes.SessionKey)?.Value;
        if (string.IsNullOrEmpty(sessionKeyBase64))
        {
            // Sin clave de sesión no hay nada que descifrar: dejamos pasar el
            // cuerpo intacto para que [Authorize] conteste 401, no un 400
            // confuso por "sobre inválido".
            await _next(context);
            return;
        }

        byte[] sessionKey;
        try
        {
            sessionKey = Convert.FromBase64String(sessionKeyBase64);
        }
        catch (FormatException)
        {
            await _next(context);
            return;
        }

        if (context.Request.ContentLength is > 0)
        {
            using var requestReader = new StreamReader(context.Request.Body, Encoding.UTF8);
            var rawRequestBody = await requestReader.ReadToEndAsync();

            string plaintext;
            try
            {
                var dto = JsonSerializer.Deserialize<CipherEnvelopeDto>(rawRequestBody)
                    ?? throw new JsonException("El sobre llegó vacío.");
                var cipher = _cipherRegistry.Resolve(dto.Algorithm, dto.Version);
                plaintext = cipher.Decrypt(dto.ToDomain(), sessionKey);
            }
            catch (Exception exception) when (
                exception is JsonException or FormatException or NotSupportedException
                or System.Security.Cryptography.CryptographicException or ArgumentException or OverflowException)
            {
                _logger.LogWarning(exception, "No fue posible descifrar el cuerpo de la petición a {Path}", context.Request.Path);
                await WritePlainErrorAsync(context);
                return;
            }

            var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
            context.Request.Body = new MemoryStream(plaintextBytes);
            context.Request.ContentLength = plaintextBytes.Length;
        }

        var originalResponseBody = context.Response.Body;
        using var bufferedResponseBody = new MemoryStream();
        context.Response.Body = bufferedResponseBody;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Response.Body = originalResponseBody;
        }

        bufferedResponseBody.Seek(0, SeekOrigin.Begin);
        var isJson = context.Response.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) ?? false;
        if (!isJson || bufferedResponseBody.Length == 0)
        {
            await bufferedResponseBody.CopyToAsync(originalResponseBody);
            return;
        }

        using var responseReader = new StreamReader(bufferedResponseBody, Encoding.UTF8);
        var rawResponseBody = await responseReader.ReadToEndAsync();

        var cipherOut = _cipherRegistry.Current;
        var envelope = cipherOut.Encrypt(rawResponseBody, sessionKey);
        var envelopeJson = JsonSerializer.Serialize(CipherEnvelopeDto.FromDomain(envelope));
        var envelopeBytes = Encoding.UTF8.GetBytes(envelopeJson);

        context.Response.ContentLength = envelopeBytes.Length;
        await originalResponseBody.WriteAsync(envelopeBytes);
    }

    private static bool IsExempt(PathString path) =>
        ExemptPrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase));

    private static async Task WritePlainErrorAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = "La carga cifrada no es válida." }));
    }
}
