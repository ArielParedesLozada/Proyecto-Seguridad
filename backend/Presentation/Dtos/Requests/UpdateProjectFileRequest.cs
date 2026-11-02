using System.ComponentModel.DataAnnotations;

namespace Backend.Presentation.Dtos.Requests;

public class UpdateProjectFileRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;
}
