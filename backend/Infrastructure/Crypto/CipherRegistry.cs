using Backend.Domain.Services;

namespace Backend.Infrastructure.Crypto;

public class CipherRegistry(IEnumerable<ICipher> ciphers) : ICipherRegistry
{
    private readonly List<ICipher> _ciphers = ciphers.ToList();

    public ICipher Current => _ciphers.Single(cipher => cipher.Algorithm == "AES-256-GCM");

    public ICipher Resolve(string algorithm, int version) =>
        _ciphers.SingleOrDefault(cipher => cipher.Algorithm == algorithm && cipher.Version == version)
        ?? throw new NotSupportedException($"Algoritmo de cifrado no soportado: {algorithm} v{version}.");
}
