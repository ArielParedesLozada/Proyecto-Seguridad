using Backend.Data.Database;
using Backend.Domain.Enums;
using Backend.Domain.Models;
using Backend.Presentation.Dtos.Requests;
using Backend.Presentation.Dtos.Responses;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Projects;

public enum ProjectFileResultStatus
{
    Success,
    Forbidden,
    Invalid,
    Conflict,
}

public record ProjectFileResult<T>(ProjectFileResultStatus Status, T? Value = default);

public class ProjectFileService(AppDatabase database)
{
    private readonly AppDatabase _database = database;

    public async Task<ProjectFileResult<List<ProjectFileTreeResponse>>> GetFilesAsync(Guid projectId, Guid userId)
    {
        if (await GetAccessAsync(projectId, userId) is null)
            return new(ProjectFileResultStatus.Forbidden);

        var files = await _database.ProjectFiles
            .AsNoTracking()
            .Where(file => file.ProjectId == projectId)
            .OrderBy(file => file.ParentId)
            .ThenBy(file => file.Name)
            .Select(file => new ProjectFileTreeResponse
            {
                Id = file.Id,
                ParentId = file.ParentId,
                Name = file.Name,
                Type = file.Type == ProjectFileType.File ? "FILE" : "FOLDER",
                CreatedAt = file.CreatedAt,
                UpdatedAt = file.UpdatedAt,
            })
            .ToListAsync();

        return new(ProjectFileResultStatus.Success, files);
    }

    public async Task<ProjectFileResult<ProjectFileResponse>> GetFileAsync(Guid projectId, Guid fileId, Guid userId)
    {
        if (await GetAccessAsync(projectId, userId) is null)
            return new(ProjectFileResultStatus.Forbidden);

        var file = await _database.ProjectFiles
            .AsNoTracking()
            .Where(file => file.ProjectId == projectId && file.Id == fileId)
            .Select(file => new ProjectFileResponse
            {
                Id = file.Id,
                ParentId = file.ParentId,
                Name = file.Name,
                Type = file.Type == ProjectFileType.File ? "FILE" : "FOLDER",
                Content = file.Content,
                CreatedAt = file.CreatedAt,
                UpdatedAt = file.UpdatedAt,
            })
            .SingleOrDefaultAsync();

        return file is null
            ? new(ProjectFileResultStatus.Forbidden)
            : new(ProjectFileResultStatus.Success, file);
    }

    public async Task<ProjectFileResult<ProjectFileResponse>> CreateFileAsync(
        Guid projectId, Guid userId, CreateProjectFileRequest request)
    {
        var access = await GetAccessAsync(projectId, userId);
        if (!CanWrite(access))
            return new(ProjectFileResultStatus.Forbidden);

        if (!IsValidName(request.Name) || !TryGetFileType(request.Type, out var type))
            return new(ProjectFileResultStatus.Invalid);

        if (!await IsValidParentAsync(projectId, request.ParentId))
            return new(ProjectFileResultStatus.Invalid);

        if (await HasDuplicateNameAsync(projectId, request.ParentId, request.Name))
            return new(ProjectFileResultStatus.Conflict);

        var file = new ProjectFile(request.Name, type, projectId, request.ParentId);
        _database.ProjectFiles.Add(file);
        await _database.SaveChangesAsync();
        return new(ProjectFileResultStatus.Success, ToFileResponse(file));
    }

    public async Task<ProjectFileResult<ProjectFileResponse>> RenameFileAsync(
        Guid projectId, Guid fileId, Guid userId, UpdateProjectFileRequest request)
    {
        var access = await GetAccessAsync(projectId, userId);
        if (!CanWrite(access))
            return new(ProjectFileResultStatus.Forbidden);

        if (!IsValidName(request.Name))
            return new(ProjectFileResultStatus.Invalid);

        var file = await _database.ProjectFiles
            .Where(file => file.ProjectId == projectId && file.Id == fileId)
            .SingleOrDefaultAsync();
        if (file is null)
            return new(ProjectFileResultStatus.Forbidden);

        if (await HasDuplicateNameAsync(projectId, file.ParentId, request.Name, fileId))
            return new(ProjectFileResultStatus.Conflict);

        file.Name = request.Name;
        file.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        return new(ProjectFileResultStatus.Success, ToFileResponse(file));
    }

    public async Task<ProjectFileResult<ProjectFileResponse>> UpdateContentAsync(
        Guid projectId, Guid fileId, Guid userId, UpdateProjectFileContentRequest request)
    {
        var access = await GetAccessAsync(projectId, userId);
        if (!CanWrite(access))
            return new(ProjectFileResultStatus.Forbidden);

        var file = await _database.ProjectFiles
            .Where(file => file.ProjectId == projectId && file.Id == fileId && file.Type == ProjectFileType.File)
            .SingleOrDefaultAsync();
        if (file is null)
            return new(ProjectFileResultStatus.Forbidden);

        file.Content = request.Content;
        file.UpdatedAt = DateTimeOffset.UtcNow;
        await _database.SaveChangesAsync();
        return new(ProjectFileResultStatus.Success, ToFileResponse(file));
    }

    public async Task<ProjectFileResult<object>> DeleteFileAsync(Guid projectId, Guid fileId, Guid userId)
    {
        var access = await GetAccessAsync(projectId, userId);
        if (!CanWrite(access))
            return new(ProjectFileResultStatus.Forbidden);

        var file = await _database.ProjectFiles
            .Where(file => file.ProjectId == projectId && file.Id == fileId)
            .SingleOrDefaultAsync();
        if (file is null)
            return new(ProjectFileResultStatus.Forbidden);

        _database.ProjectFiles.Remove(file);
        await _database.SaveChangesAsync();
        return new(ProjectFileResultStatus.Success);
    }

    private Task<ProjectAccess?> GetAccessAsync(Guid projectId, Guid userId) => _database.ProjectMembers
        .AsNoTracking()
        .Where(member => member.ProjectId == projectId && member.UserId == userId)
        .Select(member => new ProjectAccess(member.Role, member.Project.IsArchived))
        .SingleOrDefaultAsync();

    private Task<bool> IsValidParentAsync(Guid projectId, Guid? parentId) => parentId is null
        ? Task.FromResult(true)
        : _database.ProjectFiles.AnyAsync(file =>
            file.Id == parentId && file.ProjectId == projectId && file.Type == ProjectFileType.Folder);

    private Task<bool> HasDuplicateNameAsync(Guid projectId, Guid? parentId, string name, Guid? excludedFileId = null) =>
        _database.ProjectFiles.AnyAsync(file =>
            file.ProjectId == projectId
            && file.ParentId == parentId
            && file.Name == name
            && (excludedFileId == null || file.Id != excludedFileId));

    private static bool CanWrite(ProjectAccess? access) => access is not null
        && !access.IsArchived
        && access.Role is Roles.Owner or Roles.Editor;

    private static bool TryGetFileType(string type, out ProjectFileType fileType) =>
        Enum.TryParse(type, true, out fileType) && Enum.IsDefined(fileType);

    private static bool IsValidName(string? name) => !string.IsNullOrWhiteSpace(name)
        && name is not "." and not ".."
        && !name.Contains('/')
        && !name.Contains('\\')
        && !name.Any(char.IsControl);

    private static ProjectFileResponse ToFileResponse(ProjectFile file) => new()
    {
        Id = file.Id,
        ParentId = file.ParentId,
        Name = file.Name,
        Type = file.Type == ProjectFileType.File ? "FILE" : "FOLDER",
        Content = file.Content,
        CreatedAt = file.CreatedAt,
        UpdatedAt = file.UpdatedAt,
    };

    private sealed record ProjectAccess(Roles Role, bool IsArchived);
}
