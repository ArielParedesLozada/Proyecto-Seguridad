using Backend.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data.Database;

public class AppDatabase(DbContextOptions<AppDatabase> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Id);
            entity.HasIndex(u => u.Email).IsUnique();
        });
    }
}
