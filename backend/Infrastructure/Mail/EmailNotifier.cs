using Backend.Domain.Services;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Backend.Infrastructure.Mail;

public class EmailNotifier(string smtpDomain, int port, string user, string password) : INotifier
{
    private readonly string _smtpServer = smtpDomain;
    private readonly int _port = port;
    private readonly string _user = user;
    private readonly string _password = password;

    public async Task SendAsync(string to, string subject, string body)
    {
        var email = new MimeMessage();
        email.From.Add(MailboxAddress.Parse(_user));
        email.To.Add(MailboxAddress.Parse(to));
        email.Subject = subject;
        email.Body = new TextPart("html") { Text = body };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(_smtpServer, _port, SecureSocketOptions.StartTls);
        await smtp.AuthenticateAsync(_user, _password);
        await smtp.SendAsync(email);
        await smtp.DisconnectAsync(true);
    }
}
