using Backend.Data.Database;
using Microsoft.EntityFrameworkCore;

namespace Backend.Config;

public static class DatabaseConfig
{
    public static IServiceCollection AddDatabase(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AppDatabase>(options =>
            options.UseNpgsql(connectionString)
        );
        return services;
    }
}