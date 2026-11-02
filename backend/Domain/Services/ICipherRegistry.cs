namespace Backend.Domain.Services;

public interface ICipherRegistry
{
    ICipher Current { get; }
    ICipher Resolve(string algorithm, int version);
}
