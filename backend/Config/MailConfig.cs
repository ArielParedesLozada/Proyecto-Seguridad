using Backend.Domain.Services;
using Backend.Infrastructure.Mail;

namespace Backend.Config;

public static class MailConfig
{
    public static IServiceCollection AddMailer(
        this IServiceCollection services, IConfiguration configuration, string user, string password)
    {
        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "Faltan las variables de entorno MAIL_USER y/o MAIL_PASSWORD.");

        var domain = configuration.GetValue<string>("MailSettings:Domain")!;
        var port = configuration.GetValue<int>("MailSettings:Port");
        services.AddScoped<INotifier>(_ => new EmailNotifier(domain, port, user, password));
        return services;
    }
}
