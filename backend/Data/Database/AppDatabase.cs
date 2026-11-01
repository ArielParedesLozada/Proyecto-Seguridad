using Backend.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data.Database;

public class AppDatabase(DbContextOptions<AppDatabase> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<ProjectMember> ProjectMembers { get; set; }
    public DbSet<ProjectFile> ProjectFiles { get; set; }
    public DbSet<ProjectInvitation> ProjectInvitations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Id);
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Name).IsRequired();
            entity.Property(p => p.CreatedAt).IsRequired();
            entity.Property(p => p.UpdatedAt).IsRequired();
            entity.HasIndex(p => p.OwnerId);
            entity.HasIndex(p => new { p.IsArchived, p.UpdatedAt });
            entity.HasOne(p => p.Owner)
                .WithMany(u => u.OwnedProjects)
                .HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProjectMember>(entity =>
        {
            entity.ToTable("project_members");
            entity.HasKey(pm => new { pm.ProjectId, pm.UserId });
            entity.Property(pm => pm.Role).HasConversion<string>().HasMaxLength(16).IsRequired();
            entity.Property(pm => pm.JoinedAt).IsRequired();
            entity.HasIndex(pm => pm.UserId);
            entity.HasOne(pm => pm.Project)
                .WithMany(p => p.Members)
                .HasForeignKey(pm => pm.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(pm => pm.User)
                .WithMany(u => u.ProjectMemberships)
                .HasForeignKey(pm => pm.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProjectFile>(entity =>
        {
            entity.ToTable("project_files");
            entity.HasKey(file => file.Id);
            entity.Property(file => file.Name).IsRequired();
            entity.Property(file => file.Type).HasConversion<string>().IsRequired();
            entity.Property(file => file.Content).HasColumnType("text");
            entity.Property(file => file.CreatedAt).IsRequired();
            entity.Property(file => file.UpdatedAt).IsRequired();
            entity.HasIndex(file => new { file.ProjectId, file.ParentId, file.Name });
            entity.HasOne(file => file.Project)
                .WithMany(project => project.Files)
                .HasForeignKey(file => file.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(file => file.Parent)
                .WithMany(file => file.Children)
                .HasForeignKey(file => file.ParentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectInvitation>(entity =>
        {
            entity.ToTable("project_invitations");
            entity.HasKey(invitation => invitation.Id);
            entity.Property(invitation => invitation.Email).IsRequired();
            entity.Property(invitation => invitation.Role).HasConversion<string>().HasMaxLength(16).IsRequired();
            entity.Property(invitation => invitation.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
            entity.Property(invitation => invitation.TokenHash).IsRequired().HasMaxLength(64);
            entity.Property(invitation => invitation.CreatedAt).IsRequired();
            entity.Property(invitation => invitation.ExpiresAt).IsRequired();
            entity.HasIndex(invitation => invitation.TokenHash).IsUnique();
            entity.HasIndex(invitation => new { invitation.ProjectId, invitation.Email, invitation.Status });
            entity.HasOne(invitation => invitation.Project)
                .WithMany(project => project.Invitations)
                .HasForeignKey(invitation => invitation.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(invitation => invitation.InvitedBy)
                .WithMany()
                .HasForeignKey(invitation => invitation.InvitedById)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
