using Backend.Domain.Services;
using Backend.Infrastructure.Compilation;

namespace Backend.Config;

/// <summary>
/// Registro de los servicios de infraestructura en el contenedor de dependencias.
/// Sigue el patrón de los demás archivos de configuración del proyecto
/// (DatabaseConfig, AuthConfig, ServicesConfig).
/// </summary>
public static class CompilationConfig
{
    public static IServiceCollection AddCompilation(this IServiceCollection services)
    {
        services.AddScoped<IDocumentConverter, MarkdownToPdfConverter>();
        return services;
    }
}
