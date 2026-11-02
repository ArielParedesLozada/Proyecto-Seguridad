namespace Backend.Domain.Services;

/// <summary>
/// Servicio de dominio para la conversión de documentos.
/// Define el contrato de negocio para transformar contenido Markdown en un
/// documento PDF, sin acoplarse a ninguna tecnología de implementación concreta
/// (por ejemplo, cualquier herramienta o librería de infraestructura).
/// </summary>
public interface IDocumentConverter
{
    /// <summary>
    /// Convierte el contenido Markdown recibido en un documento PDF.
    /// </summary>
    /// <param name="markdown">Contenido Markdown a convertir.</param>
    /// <param name="cancellationToken">Token de cancelación de la operación.</param>
    /// <returns>Los bytes del documento PDF resultante.</returns>
    Task<byte[]> ConvertMarkdownToPdfAsync(string markdown, CancellationToken cancellationToken = default);
}
