using Backend.App.Auth;
using Backend.App.Projects;

namespace Backend.Config;

public static class ServiceConfig
{
    public static IServiceCollection AddServices(this IServiceCollection services)
    {
        services.AddScoped<LoginService>();
        services.AddScoped<LogoutService>();
        services.AddScoped<MeService>();
        services.AddScoped<ProjectService>();
        return services;
    }
}
