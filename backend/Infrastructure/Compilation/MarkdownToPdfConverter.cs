using Backend.Domain.Services;
using Markdig;
using PuppeteerSharp;
using PuppeteerSharp.Media;

namespace Backend.Infrastructure.Compilation;

/// <summary>
/// Implementación concreta de <see cref="IDocumentConverter"/> que convierte
/// Markdown a PDF usando únicamente dependencias de .NET/NuGet:
///
/// <list type="number">
///   <item><description>Markdig convierte el Markdown a HTML.</description></item>
///   <item><description>PuppeteerSharp (Chromium) renderiza ese HTML a PDF.</description></item>
/// </list>
///
/// Chromium se descarga automáticamente a través de PuppeteerSharp, por lo que no
/// se requiere instalar Chrome/Chromium manualmente en el sistema.
///
/// Toda la lógica de infraestructura queda acotada a esta capa.
/// </summary>
public class MarkdownToPdfConverter : IDocumentConverter
{
    private readonly Task<IBrowser> _browserTask;

    public MarkdownToPdfConverter()
    {
        _browserTask = LaunchBrowserAsync();
    }
    private static async Task<IBrowser> LaunchBrowserAsync()
    {
        var executablePath = Environment.GetEnvironmentVariable("CHROMIUM_PATH");

        var launchOptions = new LaunchOptions
        {
            Headless = true,
            Args = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
            ExecutablePath = executablePath,
        };

        if (string.IsNullOrWhiteSpace(executablePath))
        {
            var browserFetcher = new BrowserFetcher();
            await browserFetcher.DownloadAsync();
        }

        return await Puppeteer.LaunchAsync(launchOptions);
    }
    // Pipeline de Markdig con las extensiones comunes de Markdown
    // (tablas, listas mejoradas, tareas, notas al pie, énfasis, atributos, etc.).
    private static readonly MarkdownPipeline MarkdownPipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .UseMathematics()
        .DisableHtml()
        .Build();

    public async Task<byte[]> ConvertMarkdownToPdfAsync(string markdown, CancellationToken cancellationToken = default)
    {
        var htmlBody = Markdown.ToHtml(markdown, MarkdownPipeline);

        var htmlDocument = $$"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; img-src data:;" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
            <style>
                body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                    line-height:1.5;max-width:800px;margin:2rem auto;padding:0 1rem;color:#222;}
                code,pre{background:#f5f5f5;border-radius:4px;} pre{padding:1rem;overflow:auto;}
                table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ddd;padding:6px 8px;}
                img{max-width:100%;} a{color:#0066cc;}
            </style>
        </head>
        <body>
            {{htmlBody}}
            <script>
                window.katexRenderDone = false;
                document.addEventListener("DOMContentLoaded", function() {
                    renderMathInElement(document.body, {
                        delimiters: [
                            {left: "$$", right: "$$", display: true},
                            {left: "\\[", right: "\\]", display: true},
                            {left: "\\(", right: "\\)", display: false},
                            {left: "$", right: "$", display: false}
                        ],
                        throwOnError: false
                    });
                    window.katexRenderDone = true;
                });
            </script>
        </body>
        </html>
        """;
        var browser = await _browserTask;
        await using var page = await browser.NewPageAsync();
        page.Console += (_, e) => Console.WriteLine($"[chromium console] {e.Message.Type}: {e.Message.Text}");
        page.PageError += (_, e) => Console.WriteLine($"[chromium page error] {e.Message}");
        page.RequestFailed += (_, e) => Console.WriteLine($"[chromium request failed] {e.Request.Url} - {e.Request.FailureText}");
        await page.SetContentAsync(htmlDocument, new NavigationOptions
        {
            WaitUntil = [WaitUntilNavigation.Networkidle0]
        });
        await page.WaitForExpressionAsync("window.katexRenderDone === true", new WaitForFunctionOptions
        {
            Timeout = 5000
        });
        await using var pdfStream = await page.PdfStreamAsync(new PdfOptions
        {
            PrintBackground = true,
            Format = PaperFormat.A4,
        });

        using var memoryStream = new MemoryStream();
        await pdfStream.CopyToAsync(memoryStream, cancellationToken);
        return memoryStream.ToArray();
    }
}
