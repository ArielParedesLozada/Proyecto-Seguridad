using Backend.Data.Database;
using Backend.Domain.Enums;
using Backend.Domain.Models;
using Backend.Presentation.Dtos.Requests;
using Backend.Presentation.Dtos.Responses;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Projects;

public class ProjectService(AppDatabase database, EncryptedColumnStore encryptedColumnStore)
{
    private readonly AppDatabase _database = database;
    private readonly EncryptedColumnStore _encryptedColumnStore = encryptedColumnStore;

    public async Task<List<ProjectResponse>> GetProjectsAsync(Guid userId, bool archived)
    {
        var rows = await _database.ProjectMembers
            .AsNoTracking()
            .Where(member => member.UserId == userId && member.Project.IsArchived == archived)
            .OrderByDescending(member => member.Project.UpdatedAt)
            .Select(member => new
            {
                member.Project.Id,
                member.Project.OwnerId,
                OwnerName = member.Project.Owner.Nombre,
                member.Role,
                member.Project.CreatedAt,
                member.Project.UpdatedAt,
                member.Project.IsArchived,
            })
            .ToListAsync();

        var names = await _encryptedColumnStore.ReadProjectNamesAsync(
            rows.Select(row => row.Id).ToList(), CancellationToken.None);

        return rows.Select(row => new ProjectResponse
        {
            Id = row.Id,
            Name = names[row.Id],
            OwnerName = row.OwnerName,
            Role = RoleToString(row.Role),
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt,
            IsArchived = row.IsArchived,
        }).ToList();
    }

    public async Task<ProjectResponse?> GetProjectAsync(Guid projectId, Guid userId)
    {
        var row = await _database.ProjectMembers
            .AsNoTracking()
            .Where(member => member.ProjectId == projectId && member.UserId == userId)
            .Select(member => new
            {
                member.Project.Id,
                OwnerName = member.Project.Owner.Nombre,
                member.Role,
                member.Project.CreatedAt,
                member.Project.UpdatedAt,
                member.Project.IsArchived,
            })
            .SingleOrDefaultAsync();
        if (row is null)
            return null;

        var names = await _encryptedColumnStore.ReadProjectNamesAsync([row.Id], CancellationToken.None);
        return new ProjectResponse
        {
            Id = row.Id,
            Name = names[row.Id],
            OwnerName = row.OwnerName,
            Role = RoleToString(row.Role),
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt,
            IsArchived = row.IsArchived,
        };
    }

    public Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request) =>
        CreateOwnedProjectAsync(userId, request.Name);

    public async Task<ProjectResponse?> UpdateProjectAsync(Guid projectId, Guid userId, UpdateProjectRequest request)
    {
        EnsureName(request.Name);
        var project = await GetOwnedProjectAsync(projectId, userId);
        if (project is null)
            return null;

        project.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        await _encryptedColumnStore.WriteProjectNameAsync(projectId, request.Name, CancellationToken.None);

        var ownerName = await GetOwnerNameAsync(project.OwnerId);
        return ToOwnerResponse(project, ownerName, request.Name);
    }

    public async Task<bool> ArchiveProjectAsync(Guid projectId, Guid userId)
    {
        var project = await GetOwnedProjectAsync(projectId, userId);
        if (project is null)
            return false;

        project.IsArchived = true;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        return true;
    }

    public async Task<ProjectResponse?> CopyProjectAsync(Guid sourceProjectId, Guid userId)
    {
        var isMember = await _database.ProjectMembers
            .AnyAsync(member => member.ProjectId == sourceProjectId && member.UserId == userId);
        if (!isMember)
            return null;

        var sourceName = (await _encryptedColumnStore.ReadProjectNamesAsync([sourceProjectId], CancellationToken.None))[sourceProjectId];

        var sourceFiles = await _database.ProjectFiles
            .AsNoTracking()
            .Where(file => file.ProjectId == sourceProjectId)
            .Select(file => new { file.Id, file.ParentId, file.Name, file.Type })
            .ToListAsync();

        var ownerName = await GetOwnerNameAsync(userId);
        var newName = $"{sourceName} - Copia";
        await using var transaction = await _database.Database.BeginTransactionAsync();
        var project = new Project(newName, userId);
        _database.Projects.Add(project);
        _database.ProjectMembers.Add(new ProjectMember(project.Id, userId, Roles.Owner));

        var copies = sourceFiles.ToDictionary(
            file => file.Id,
            file => new ProjectFile(file.Name, file.Type, project.Id, null));
        _database.ProjectFiles.AddRange(copies.Values);
        foreach (var sourceFile in sourceFiles)
            copies[sourceFile.Id].ParentId = sourceFile.ParentId is null ? null : copies[sourceFile.ParentId.Value].Id;

        await _database.SaveChangesAsync();
        await _encryptedColumnStore.WriteProjectNameAsync(project.Id, newName, CancellationToken.None);
        foreach (var sourceFile in sourceFiles)
            await _encryptedColumnStore.CopyProjectFileContentAsync(sourceFile.Id, copies[sourceFile.Id].Id, CancellationToken.None);
        await transaction.CommitAsync();
        return ToOwnerResponse(project, ownerName, newName);
    }

    private async Task<ProjectResponse> CreateOwnedProjectAsync(Guid userId, string name)
    {
        EnsureName(name);
        var ownerName = await GetOwnerNameAsync(userId);

        await using var transaction = await _database.Database.BeginTransactionAsync();
        var project = new Project(name, userId);
        _database.Projects.Add(project);
        _database.ProjectMembers.Add(new ProjectMember(project.Id, userId, Roles.Owner));
        var mainFile = new ProjectFile("main.md", ProjectFileType.File, project.Id, null);
        _database.ProjectFiles.Add(mainFile);
        await _database.SaveChangesAsync();
        await _encryptedColumnStore.WriteProjectNameAsync(project.Id, name, CancellationToken.None);
        await _encryptedColumnStore.WriteProjectFileContentAsync(mainFile.Id, mainFile.Content, CancellationToken.None);
        await transaction.CommitAsync();

        return ToOwnerResponse(project, ownerName, name);
    }

    private Task<Project?> GetOwnedProjectAsync(Guid projectId, Guid userId) => _database.Projects
        .Where(project => project.Id == projectId
            && project.OwnerId == userId
            && project.Members.Any(member => member.UserId == userId && member.Role == Roles.Owner))
        .SingleOrDefaultAsync();

    private async Task<string> GetOwnerNameAsync(Guid ownerId) => await _database.Users
        .AsNoTracking()
        .Where(user => user.Id == ownerId)
        .Select(user => user.Nombre)
        .SingleOrDefaultAsync()
        ?? throw new InvalidOperationException("El usuario autenticado no existe.");

    private static ProjectResponse ToOwnerResponse(Project project, string ownerName, string name)
    {
        return new()
        {
            Id = project.Id,
            Name = name,
            OwnerName = ownerName,
            Role = "OWNER",
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt,
            IsArchived = project.IsArchived,
        };
    }

    private static string RoleToString(Roles role) => role switch
    {
        Roles.Owner => "OWNER",
        Roles.Editor => "EDITOR",
        _ => "VIEWER",
    };

    private static void EnsureName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre del proyecto es obligatorio.", nameof(name));
    }
}
