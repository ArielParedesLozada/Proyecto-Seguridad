using Backend.Config;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data.Database;

public class EncryptedColumnStore(AppDatabase database, CryptoMasterKey masterKey)
{
    private readonly AppDatabase _database = database;
    private readonly string _key = Convert.ToBase64String(masterKey.Value);

    public async Task<string?> ReadProjectFileContentAsync(Guid fileId, CancellationToken cancellationToken)
    {
        var key = _key;
        return await _database.Database
            .SqlQuery<string?>($@"
                SELECT CASE WHEN content_cipher IS NULL THEN NULL
                            ELSE app_crypto.decrypt_text(content_cipher, {key}) END AS ""Value""
                FROM project_files WHERE ""Id"" = {fileId}")
            .SingleOrDefaultAsync(cancellationToken);
    }

    public Task WriteProjectFileContentAsync(Guid fileId, string? content, CancellationToken cancellationToken)
    {
        var key = _key;
        return _database.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE project_files
            SET content_cipher = CASE WHEN {content} IS NULL THEN NULL
                                       ELSE app_crypto.encrypt_text({content}, {key}) END
            WHERE ""Id"" = {fileId}", cancellationToken);
    }

    public Task CopyProjectFileContentAsync(Guid sourceFileId, Guid targetFileId, CancellationToken cancellationToken) =>
        _database.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE project_files
            SET content_cipher = (SELECT content_cipher FROM project_files WHERE ""Id"" = {sourceFileId})
            WHERE ""Id"" = {targetFileId}", cancellationToken);

    public async Task<Dictionary<Guid, string>> ReadProjectNamesAsync(
        IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken)
    {
        var key = _key;
        var ids = projectIds.ToArray();
        var rows = await _database.Database
            .SqlQuery<ProjectNameRow>($@"
                SELECT ""Id"" AS ""Id"", app_crypto.decrypt_text(name_cipher, {key}) AS ""Name""
                FROM projects WHERE ""Id"" = ANY({ids})")
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(row => row.Id, row => row.Name);
    }

    public Task WriteProjectNameAsync(Guid projectId, string name, CancellationToken cancellationToken)
    {
        var key = _key;
        return _database.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE projects
            SET name_cipher = app_crypto.encrypt_text({name}, {key})
            WHERE ""Id"" = {projectId}", cancellationToken);
    }

    private sealed record ProjectNameRow(Guid Id, string Name);
}
