namespace Backend.Presentation.Dtos.Responses;

public class SessionKeyResponse
{
    public string Key { get; set; } = string.Empty;
    public string Algorithm { get; set; } = string.Empty;
    public int Version { get; set; }
}
