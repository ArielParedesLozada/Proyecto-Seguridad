using Backend.App.Auth;

namespace Backend.Config;

public static class ServiceConfig
{
    public static IServiceCollection AddServices(this IServiceCollection services)
    {
        services.AddScoped<LoginService>();
        services.AddScoped<LogoutService>();
        services.AddScoped<MeService>();
        return services;
    }
}