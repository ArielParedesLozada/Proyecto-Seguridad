using System.Security.Cryptography;
using Backend.Domain.Services;

namespace Backend.Infrastructure.Crypto;

public class AesGcmCipher : ICipher
{
    private const int IvSizeBytes = 12;
    private const int TagSizeBytes = 16;

    public string Algorithm => "AES-256-GCM";
    public int Version => 1;

    public CipherEnvelope Encrypt(string plaintext, byte[] key)
    {
        EnsureKeySize(key);

        var plaintextBytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var iv = RandomNumberGenerator.GetBytes(IvSizeBytes);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[TagSizeBytes];

        using var aesGcm = new AesGcm(key, TagSizeBytes);
        aesGcm.Encrypt(iv, plaintextBytes, ciphertext, tag);

        var ciphertextWithTag = new byte[ciphertext.Length + tag.Length];
        ciphertext.CopyTo(ciphertextWithTag, 0);
        tag.CopyTo(ciphertextWithTag, ciphertext.Length);

        return new CipherEnvelope(Algorithm, Version, Convert.ToBase64String(iv), Convert.ToBase64String(ciphertextWithTag));
    }

    public string Decrypt(CipherEnvelope envelope, byte[] key)
    {
        EnsureKeySize(key);

        var iv = Convert.FromBase64String(envelope.Iv);
        var ciphertextWithTag = Convert.FromBase64String(envelope.CipherText);

        var ciphertextLength = ciphertextWithTag.Length - TagSizeBytes;
        var ciphertext = ciphertextWithTag[..ciphertextLength];
        var tag = ciphertextWithTag[ciphertextLength..];
        var plaintextBytes = new byte[ciphertextLength];

        using var aesGcm = new AesGcm(key, TagSizeBytes);
        aesGcm.Decrypt(iv, ciphertext, tag, plaintextBytes);

        return System.Text.Encoding.UTF8.GetString(plaintextBytes);
    }

    private static void EnsureKeySize(byte[] key)
    {
        if (key.Length != 32)
            throw new ArgumentException("La clave debe medir 32 bytes.", nameof(key));
    }
}
