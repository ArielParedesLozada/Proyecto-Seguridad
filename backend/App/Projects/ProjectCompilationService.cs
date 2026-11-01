using Backend.Data.Database;
using Backend.Domain.Enums;
using Backend.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.App.Projects;

public enum ProjectCompilationStatus
{
    Success,
    Forbidden,
    MainFileNotFound,
}

public record ProjectCompilationResult(ProjectCompilationStatus Status, byte[]? Pdf = null);

public class ProjectCompilationService(
    AppDatabase database, EncryptedColumnStore encryptedColumnStore, IDocumentConverter documentConverter)
{
    private readonly AppDatabase _database = database;
    private readonly EncryptedColumnStore _encryptedColumnStore = encryptedColumnStore;
    private readonly IDocumentConverter _documentConverter = documentConverter;

    public async Task<ProjectCompilationResult> CompileAsync(Guid projectId, Guid userId, CancellationToken cancellationToken)
    {
        var canReadProject = await _database.ProjectMembers
            .AsNoTracking()
            .AnyAsync(member => member.ProjectId == projectId && member.UserId == userId, cancellationToken);
        if (!canReadProject)
            return new(ProjectCompilationStatus.Forbidden);

        var mainFileId = await _database.ProjectFiles
            .AsNoTracking()
            .Where(file => file.ProjectId == projectId
                && file.ParentId == null
                && file.Name == "main.md"
                && file.Type == ProjectFileType.File)
            .Select(file => file.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (mainFileId == Guid.Empty)
            return new(ProjectCompilationStatus.MainFileNotFound);

        var content = await _encryptedColumnStore.ReadProjectFileContentAsync(mainFileId, cancellationToken);
        var pdf = await _documentConverter.ConvertMarkdownToPdfAsync(content ?? string.Empty, cancellationToken);
        return new(ProjectCompilationStatus.Success, pdf);
    }
}
