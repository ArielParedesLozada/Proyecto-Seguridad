namespace Backend.Domain.Services;

public interface INotifier
{
    Task SendAsync(string to, string subject, string body);
}
