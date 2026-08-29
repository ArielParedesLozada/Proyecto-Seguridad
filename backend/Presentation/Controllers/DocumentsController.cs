using Backend.Domain.Services;
using Backend.Presentation.Dtos.Requests;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Presentation.Controllers;

/// <summary>
/// Controlador de presentación para la conversión de documentos.
/// Expone un endpoint HTTP que convierte contenido Markdown a PDF delegando
/// la conversión al servicio de dominio <see cref="IDocumentConverter"/>.
/// No contiene ninguna lógica específica de infraestructura.
/// </summary>
[ApiController]
[Route("documents")]
public class DocumentsController(IDocumentConverter documentConverter) : ControllerBase
{
    /// <summary>
    /// Convierte el contenido Markdown recibido a un documento PDF.
    /// </summary>
    /// <param name="request">Cuerpo de la petición con el Markdown.</param>
    /// <param name="cancellationToken">Token de cancelación.</param>
    /// <returns>El documento PDF generado (application/pdf).</returns>
    [HttpPost("convert")]
    public async Task<IActionResult> ConvertMarkdownToPdf(
        [FromBody] ConvertDocumentRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Markdown))
            return BadRequest("El contenido Markdown no puede estar vacío.");

        var pdfBytes = await documentConverter.ConvertMarkdownToPdfAsync(request.Markdown, cancellationToken);

        return File(pdfBytes, "application/pdf", "document.pdf");
    }
}
