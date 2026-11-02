using System.Security.Claims;
using System.Security.Cryptography;
using Backend.App.Auth;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Backend.Config;

public class FrontendOptions
{
    public const string SectionName = "Frontend";

    public string BaseUrl { get; set; } = "http://localhost:4200";
}

public static class AuthConfig
{
    public const string CorsPolicyName = "Frontend";

    public static IServiceCollection AddAuth(this IServiceCollection services, string clientId, string clientSecret, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
            throw new InvalidOperationException(
                "Faltan las variables de entorno GOOGLE_OAUTH_CLIENT_ID y/o GOOGLE_OAUTH_CLIENT_SECRET.");

        var frontendUrl = configuration[$"{FrontendOptions.SectionName}:BaseUrl"] ?? new FrontendOptions().BaseUrl;

        services.Configure<FrontendOptions>(configuration.GetSection(FrontendOptions.SectionName));

        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "overleaf_session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromDays(7);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            })
            .AddGoogle(options =>
            {
                options.ClientId = clientId;
                options.ClientSecret = clientSecret;
                options.CallbackPath = "/signin-google";
                options.Events.OnCreatingTicket = async context =>
                {
                    var loginService = context.HttpContext.RequestServices.GetRequiredService<LoginService>();
                    var user = await loginService.LoginWithGoogleAsync(context.Principal!);
                    var identity = (ClaimsIdentity)context.Principal!.Identity!;
                    identity.AddClaim(new Claim(AuthClaimTypes.UserId, user.Id.ToString()));

                    var sessionKey = RandomNumberGenerator.GetBytes(32);
                    identity.AddClaim(new Claim(AuthClaimTypes.SessionKey, Convert.ToBase64String(sessionKey)));
                };
                options.Events.OnRemoteFailure = context =>
                {
                    context.Response.Redirect($"{frontendUrl}/login?error=google");
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            });

        services.AddCors(corsOptions => corsOptions.AddPolicy(CorsPolicyName, policy =>
            policy.WithOrigins(frontendUrl)
                .AllowCredentials()
                .AllowAnyHeader()
                .AllowAnyMethod()));

        return services;
    }
}
