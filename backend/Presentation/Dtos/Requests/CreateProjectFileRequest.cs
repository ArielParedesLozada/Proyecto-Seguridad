using System.ComponentModel.DataAnnotations;

namespace Backend.Presentation.Dtos.Requests;

public class CreateProjectFileRequest
{
    public Guid? ParentId { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Type { get; set; } = string.Empty;
}
