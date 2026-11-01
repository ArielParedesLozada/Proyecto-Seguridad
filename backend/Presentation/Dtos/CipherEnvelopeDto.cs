using System.Text.Json.Serialization;
using Backend.Domain.Services;

namespace Backend.Presentation.Dtos;

public class CipherEnvelopeDto
{
    [JsonPropertyName("alg")]
    public string Algorithm { get; set; } = string.Empty;

    [JsonPropertyName("v")]
    public int Version { get; set; }

    [JsonPropertyName("iv")]
    public string Iv { get; set; } = string.Empty;

    [JsonPropertyName("ct")]
    public string CipherText { get; set; } = string.Empty;

    public static CipherEnvelopeDto FromDomain(CipherEnvelope envelope) => new()
    {
        Algorithm = envelope.Algorithm,
        Version = envelope.Version,
        Iv = envelope.Iv,
        CipherText = envelope.CipherText,
    };

    public CipherEnvelope ToDomain() => new(Algorithm, Version, Iv, CipherText);
}
