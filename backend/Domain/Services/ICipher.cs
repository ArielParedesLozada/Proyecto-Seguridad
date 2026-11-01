namespace Backend.Domain.Services;

public record CipherEnvelope(string Algorithm, int Version, string Iv, string CipherText);

public interface ICipher
{
    string Algorithm { get; }
    int Version { get; }
    CipherEnvelope Encrypt(string plaintext, byte[] key);
    string Decrypt(CipherEnvelope envelope, byte[] key);
}
