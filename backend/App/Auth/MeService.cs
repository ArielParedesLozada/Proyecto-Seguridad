using System.Security.Claims;
using Backend.Data.Database;
using Backend.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Auth;

public class MeService(AppDatabase database)
{
    private readonly AppDatabase _database = database;

    public Task<User?> GetCurrentUserAsync(ClaimsPrincipal principal)
    {
        if (!Guid.TryParse(principal.FindFirstValue(AuthClaimTypes.UserId), out var userId))
            return Task.FromResult<User?>(null);
        return _database.Users.SingleOrDefaultAsync(u => u.Id == userId);
    }
}
