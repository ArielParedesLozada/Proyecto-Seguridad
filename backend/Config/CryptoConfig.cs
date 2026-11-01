using Backend.Data.Database;
using Backend.Domain.Services;
using Backend.Infrastructure.Crypto;

namespace Backend.Config;

public record CryptoMasterKey(byte[] Value);

public static class CryptoConfig
{
    public static IServiceCollection AddCrypto(this IServiceCollection services, string masterKeyBase64)
    {
        if (string.IsNullOrWhiteSpace(masterKeyBase64))
            throw new InvalidOperationException("Falta la variable de entorno CRYPTO_MASTER_KEY.");

        byte[] masterKey;
        try
        {
            masterKey = Convert.FromBase64String(masterKeyBase64);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("CRYPTO_MASTER_KEY no es un base64 válido.");
        }

        if (masterKey.Length != 32)
            throw new InvalidOperationException("CRYPTO_MASTER_KEY debe decodificar a 32 bytes.");

        services.AddSingleton(new CryptoMasterKey(masterKey));
        services.AddSingleton<ICipher, AesGcmCipher>();
        services.AddSingleton<ICipherRegistry, CipherRegistry>();
        services.AddScoped<EncryptedColumnStore>();
        return services;
    }
}
