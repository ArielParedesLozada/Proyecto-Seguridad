using System.Security.Claims;
using Backend.Data.Database;
using Backend.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Auth;

public class LoginService(AppDatabase database)
{
    private readonly AppDatabase _database = database;

    public async Task<User> LoginWithGoogleAsync(ClaimsPrincipal principal)
    {
        var googleId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Google no devolvió el identificador del usuario.");
        var email = principal.FindFirstValue(ClaimTypes.Email)
            ?? throw new InvalidOperationException("Google no devolvió el correo del usuario.");
        var nombre = principal.FindFirstValue(ClaimTypes.Name) ?? email;

        var user = await _database.Users.SingleOrDefaultAsync(u => u.GoogleId == googleId);
        if (user is null)
            user = await _database.Users.SingleOrDefaultAsync(u => u.Email == email);

        if (user is null)
        {
            user = new User(email, nombre, googleId);
            _database.Users.Add(user);
        }
        else
        {
            user.GoogleId = googleId;
            user.Nombre = nombre;
        }

        await _database.SaveChangesAsync();
        return user;
    }
}
