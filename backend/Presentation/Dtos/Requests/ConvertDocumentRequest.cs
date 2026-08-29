namespace Backend.Presentation.Dtos.Requests;

/// <summary>
/// Cuerpo de la petición para convertir Markdown a PDF.
/// </summary>
public class ConvertDocumentRequest
{
    /// <summary>
    /// Contenido Markdown que se desea convertir a PDF.
    /// </summary>
    public string Markdown { get; set; } = string.Empty;
}
