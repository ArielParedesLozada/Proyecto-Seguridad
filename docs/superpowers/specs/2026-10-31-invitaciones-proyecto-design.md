# Diseño: invitaciones a proyectos por correo electrónico

**Fecha:** 2026-10-31
**Estado:** aprobado para planificación
**Repositorio:** clon de Overleaf (backend .NET 8 + frontend Angular 22)

---

## 1. Intención y por qué

Hoy un proyecto solo lo ve su dueño: el `ProjectMember` con rol `Owner` se crea
junto con el proyecto y no existe ninguna forma de añadir a nadie más. La tabla
`project_members` y el enum `Roles { Owner, Editor, Viewer }` ya están en su
lugar y toda la autorización del backend se decide contra ellos, pero nada
escribe filas nuevas.

Esta funcionalidad abre esa puerta: el dueño de un proyecto invita a alguien
**por correo electrónico**, eligiendo si entra como editor o como lector. El
invitado recibe un enlace, lo acepta, y desde ese momento el proyecto le aparece
en su lista y puede abrirlo con los permisos que le dieron.

Es el requisito central pendiente de `TODO.md` y la precondición de la
colaboración en tiempo real (que **no** entra aquí).

### Restricción que define el diseño

Los `User` solo se crean cuando alguien entra con Google (`LoginService.LoginWithGoogleAsync`).
Por lo tanto se puede invitar a un correo que **todavía no existe** en la base de
datos. La invitación se guarda por **correo**, no por `userId`, y el
`ProjectMember` se crea recién al aceptar, cuando ya hay un `User` autenticado.

---

## 2. Objetivos, no-objetivos, anti-objetivos

### Objetivos

1. El dueño invita por correo indicando rol (`Editor` o `Viewer`).
2. El correo sale por un **servidor SMTP real** (Gmail) y lleva un enlace único.
3. El invitado, tras autenticarse con Google, acepta y obtiene acceso.
4. Tras aceptar, el proyecto aparece en su lista (`/projects`, `/projects/shared`)
   y puede abrirlo en el editor con los permisos de su rol.
5. El dueño ve las invitaciones pendientes, puede revocarlas y reenviar el correo.

### No-objetivos (fuera de alcance, no implementar)

- Edición en tiempo real / presencia de usuarios.
- Control de cambios (autoría e historial de modificaciones).
- Cambiar el rol de un miembro ya aceptado, o expulsarlo.
- Transferir la propiedad del proyecto.
- Invitaciones a nivel de organización o enlaces públicos "cualquiera con el enlace".
- Plantillas de correo en archivos; el HTML se arma en código como en el
  repositorio de referencia.
- Cola de reintentos de correo (Hangfire u otro). El envío es sincrónico.

### Anti-objetivos (señales de que salió mal aunque "funcione")

- Que un no-miembro pueda distinguir entre "este proyecto no existe" y "existe
  pero no es tuyo". Todo acceso ajeno debe seguir devolviendo **403, nunca 404**.
- Que el token de invitación quede guardado en claro en la base de datos.
- Que el enlace de invitación permita un *open redirect* al volver del login.
- Que la interfaz oculte un botón y eso se confunda con autorización: la decisión
  siempre la toma el backend.
- Que se pueda escalar privilegios invitando a alguien como `Owner`.

---

## 3. Restricciones

- Arquitectura y convenciones ya documentadas en `backend/README.md` y
  `frontend/README.md`. **Leer ambos antes de escribir código.** Este diseño no
  introduce patrones nuevos; reutiliza los existentes.
- SMTP real de Gmail: `smtp.gmail.com:587` con StartTls. Requiere una
  **contraseña de aplicación** de Google (la cuenta debe tener 2FA activo); la
  contraseña normal de la cuenta no funciona.
- El patrón de correo se copia del repositorio `ArielParedesLozada/Proyecto-Gestion-7ASW`,
  que tiene el mismo esqueleto de capas (ver §5.1).
- Frontend sin `HttpClient` ni RxJS: `fetch` + `async/await`, signals, componentes
  standalone, control flow `@if`/`@for`.
- La API no redirige: `AuthConfig` ya fuerza 401/403 en lugar de redirecciones.

---

## 4. Enfoques considerados

| Enfoque | Qué implica | Trade-off |
|---|---|---|
| **A. Token opaco + página de aceptación en el frontend** *(elegido)* | Tabla `project_invitations` con hash del token. El correo apunta a `/invitations/:token` en Angular; esa pantalla exige sesión y llama a `POST /invitations/{token}/accept`. | Un clic más, y obliga a resolver el retorno al login (§5.5). A cambio: la API no redirige, hay dónde mostrar "vencida"/"revocada"/"no es tu correo", y funciona cuando el invitado aún no tiene cuenta. |
| B. Enlace directo al backend con redirección | `GET /invitations/{token}` dispara el challenge de Google, acepta sola y redirige al editor. | Un clic menos, pero mete navegación y redirecciones en una API que hoy devuelve 401/403, y no deja pantalla para los estados de error ni para confirmar el rol antes de entrar. |
| C. Invitar solo a usuarios ya registrados | `ProjectMember` en estado pendiente; el correo es un simple aviso. | Mucho más barato, pero incumple el requisito: no se puede invitar a quien todavía no tiene cuenta. |

**Decisión: A.** Es la única que satisface la restricción de §1 sin romper el
contrato de la API.

---

## 5. El cómo, ya decidido

> **Dos decisiones de producto confirmadas** con el dueño del proyecto, de las que
> dependen varias partes de lo que sigue:
>
> 1. **El enlace vale solo para el correo invitado.** Abrirlo con otra cuenta de
>    Google da 403 y el mensaje "esta invitación es para `<correo>`". El enlace no
>    es una credencial transferible; reenviarlo no regala acceso. De aquí sale el
>    estado `EmailMismatch`.
> 2. **Se puede invitar a cualquier correo**, incluso de dominios que no son de
>    Google. El formulario advierte que hace falta una cuenta de Google, pero no
>    bloquea.

### 5.1 Infraestructura de correo (copiada del repositorio de referencia)

Paquete nuevo en `backend/backend.csproj`:

```xml
<!-- Envío de correo -->
<PackageReference Include="MailKit" Version="4.15.1" />
```

**`Domain/Services/INotifier.cs`** — contrato, sin dependencias de framework:

```csharp
namespace Backend.Domain.Services;

public interface INotifier
{
    Task SendAsync(string to, string subject, string body);
}
```

> El repositorio de referencia incluye además `SendWithAttachmentAsync`. **No la
> añadas**: aquí no se envían adjuntos y el contrato debe quedarse en lo que se usa.

**`Infrastructure/Mail/EmailNotifier.cs`** — misma forma que la referencia,
con primary constructor y los cuatro parámetros de conexión:

```csharp
using Backend.Domain.Services;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Backend.Infrastructure.Mail;

public class EmailNotifier(string smtpDomain, int port, string user, string password) : INotifier
{
    private readonly string _smtpServer = smtpDomain;
    private readonly int _port = port;
    private readonly string _user = user;
    private readonly string _password = password;

    public async Task SendAsync(string to, string subject, string body)
    {
        var email = new MimeMessage();
        email.From.Add(MailboxAddress.Parse(_user));
        email.To.Add(MailboxAddress.Parse(to));
        email.Subject = subject;
        email.Body = new TextPart("html") { Text = body };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(_smtpServer, _port, SecureSocketOptions.StartTls);
        await smtp.AuthenticateAsync(_user, _password);
        await smtp.SendAsync(email);
        await smtp.DisconnectAsync(true);
    }
}
```

**`Config/MailConfig.cs`** — igual que `MailConfig` de la referencia:

```csharp
public static class MailConfig
{
    public static IServiceCollection AddMailer(
        this IServiceCollection services, IConfiguration configuration, string user, string password)
    {
        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "Faltan las variables de entorno MAIL_USER y/o MAIL_PASSWORD.");

        var domain = configuration.GetValue<string>("MailSettings:Domain")!;
        var port = configuration.GetValue<int>("MailSettings:Port");
        services.AddScoped<INotifier>(_ => new EmailNotifier(domain, port, user, password));
        return services;
    }
}
```

El `throw` sigue el criterio ya establecido en `AuthConfig`: la app no arranca si
falta configuración obligatoria, no hay modo degradado.

**`appsettings.json`** — añadir la sección (el host y el puerto no son secretos):

```json
"MailSettings": {
  "Domain": "smtp.gmail.com",
  "Port": 587
}
```

**`backend/.env`** — dos claves nuevas (el archivo está en `.gitignore`):

```
MAIL_USER=tucuenta@gmail.com
MAIL_PASSWORD=<contraseña de aplicación de 16 caracteres, sin espacios>
```

**`Program.cs`** — leer las variables y encadenar `AddMailer` junto a las demás:

```csharp
var MAIL_USER = Environment.GetEnvironmentVariable("MAIL_USER")!;
var MAIL_PASSWORD = Environment.GetEnvironmentVariable("MAIL_PASSWORD")!;

builder.Services
    .AddDatabase(CONNECTION_STRING)
    .AddServices()
    .AddCompilation()
    .AddMailer(builder.Configuration, MAIL_USER, MAIL_PASSWORD)
    .AddAuth(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, builder.Configuration);
```

Documentar las dos variables nuevas en la sección "Ejecución" de `backend/README.md`.

### 5.2 Modelo de datos

**`Domain/Enums/InvitationStatus.cs`**

```csharp
namespace Backend.Domain.Enums;

public enum InvitationStatus
{
    Pending,
    Accepted,
    Revoked,
}
```

`Expired` **no** se persiste: se deriva de `ExpiresAt` al leer. Guardar un estado
que depende del reloj obliga a un proceso que lo actualice y se desincroniza.

**`Domain/Models/ProjectInvitation.cs`** — mismo estilo que las demás entidades
(primary constructor, propiedades `{ get; set; }`):

```csharp
using Backend.Domain.Enums;

namespace Backend.Domain.Models;

public class ProjectInvitation(
    Guid projectId, string email, Roles role, string tokenHash, Guid invitedById, DateTimeOffset expiresAt)
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; } = projectId;
    /// <summary>Correo del invitado, normalizado a minúsculas.</summary>
    public string Email { get; set; } = email;
    public Roles Role { get; set; } = role;
    /// <summary>SHA-256 en hexadecimal del token. El token en claro nunca se guarda.</summary>
    public string TokenHash { get; set; } = tokenHash;
    public Guid InvitedById { get; set; } = invitedById;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = expiresAt;
    public DateTimeOffset? AcceptedAt { get; set; }
    public Guid? AcceptedByUserId { get; set; }

    public Project Project { get; set; } = null!;
    public User InvitedBy { get; set; } = null!;
}
```

En `Domain/Models/Project.cs` añadir la colección inversa:

```csharp
public ICollection<ProjectInvitation> Invitations { get; set; } = [];
```

**`Data/Database/AppDatabase.cs`** — `DbSet` y mapeo en `OnModelCreating`:

```csharp
public DbSet<ProjectInvitation> ProjectInvitations { get; set; }

modelBuilder.Entity<ProjectInvitation>(entity =>
{
    entity.ToTable("project_invitations");
    entity.HasKey(invitation => invitation.Id);
    entity.Property(invitation => invitation.Email).IsRequired();
    entity.Property(invitation => invitation.Role).HasConversion<string>().HasMaxLength(16).IsRequired();
    entity.Property(invitation => invitation.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
    entity.Property(invitation => invitation.TokenHash).IsRequired().HasMaxLength(64);
    entity.Property(invitation => invitation.CreatedAt).IsRequired();
    entity.Property(invitation => invitation.ExpiresAt).IsRequired();
    entity.HasIndex(invitation => invitation.TokenHash).IsUnique();
    entity.HasIndex(invitation => new { invitation.ProjectId, invitation.Email, invitation.Status });
    entity.HasOne(invitation => invitation.Project)
        .WithMany(project => project.Invitations)
        .HasForeignKey(invitation => invitation.ProjectId)
        .OnDelete(DeleteBehavior.Cascade);
    entity.HasOne(invitation => invitation.InvitedBy)
        .WithMany()
        .HasForeignKey(invitation => invitation.InvitedById)
        .OnDelete(DeleteBehavior.Restrict);
});
```

Migración: `dotnet ef migrations add AddProjectInvitations`. `Program.cs` ya
ejecuta `Migrate()` al arrancar.

### 5.3 Token

- Generación: 32 bytes criptográficamente aleatorios, codificados en Base64Url
  (seguro para URL, sin `+`, `/` ni `=`):

  ```csharp
  var tokenBytes = RandomNumberGenerator.GetBytes(32);
  var token = WebEncoders.Base64UrlEncode(tokenBytes);   // Microsoft.AspNetCore.WebUtilities
  ```

- Persistencia: solo `SHA256(token)` en hexadecimal minúsculas. El token en claro
  existe únicamente en memoria y en el cuerpo del correo.
- Búsqueda: se hashea el token recibido y se compara contra `TokenHash` (índice único).
- Vigencia: **7 días** desde la creación. Es el mismo horizonte que la cookie de
  sesión; suficiente para que alguien revise el correo sin dejar enlaces vivos
  indefinidamente.
- El token **no** se devuelve en ninguna respuesta de la API, ni al dueño. Si
  quiere que el invitado lo reciba otra vez, usa "reenviar", que genera un token
  nuevo e invalida el anterior.

### 5.4 Capa App: `ProjectInvitationService`

`App/Projects/ProjectInvitationService.cs`, siguiendo el patrón enum + record de
`ProjectFileService`:

```csharp
public enum ProjectInvitationResultStatus
{
    Success,
    Forbidden,      // no es dueño, o el proyecto está archivado
    Invalid,        // correo mal formado, rol no permitido
    Conflict,       // ya es miembro, o ya hay una invitación pendiente
    NotFound,       // token inexistente
    Expired,        // token vencido o ya usado/revocado
    EmailMismatch,  // el token no corresponde al correo de la sesión
    MailFailed,     // la invitación se creó pero el SMTP falló
}

public record ProjectInvitationResult<T>(ProjectInvitationResultStatus Status, T? Value = default);
```

Constructor: `ProjectInvitationService(AppDatabase database, INotifier notifier, IOptions<FrontendOptions> frontendOptions, ILogger<ProjectInvitationService> logger)`.
`FrontendOptions` ya existe en `Config/AuthConfig.cs` y ya está registrado con
`services.Configure<FrontendOptions>(...)`; de ahí sale la URL base del enlace.

#### Métodos

**`InviteAsync(Guid projectId, Guid userId, CreateInvitationRequest request)`**
→ `ProjectInvitationResult<InvitationResponse>`

1. Verificar que `userId` es **dueño** del proyecto y que **no está archivado**.
   Reutilizar la forma de `ProjectService.GetOwnedProjectAsync` (exige
   `OwnerId == userId` y membresía con rol `Owner`). Si no → `Forbidden`.
2. Normalizar el correo: `request.Email.Trim().ToLowerInvariant()`. Validar con
   `MailboxAddress.TryParse` (ya viene con MailKit). Si falla → `Invalid`.
   **No filtrar por dominio.** Se acepta cualquier correo con formato válido,
   incluidos los que no son de Google: Google Workspace usa dominios propios y
   bloquearlos rompería cuentas legítimas. Si el destinatario no puede entrar con
   Google, simplemente no llegará a aceptar. *(Decidido por el dueño del proyecto.)*
3. Validar el rol: solo `"EDITOR"` o `"VIEWER"` (case-insensitive). Cualquier
   otra cosa, incluido `"OWNER"`, → `Invalid`. **Esto es la defensa contra
   escalada de privilegios; no delegarla al frontend.**
4. Si el correo es el del propio dueño → `Conflict`.
5. Si ya existe un `User` con ese correo que ya es `ProjectMember` del proyecto
   → `Conflict`.
6. Si ya existe una invitación `Pending` y no vencida para ese
   `(ProjectId, Email)` → `Conflict`.
7. Generar token, crear la invitación con `ExpiresAt = UtcNow.AddDays(7)` y
   guardar (`SaveChangesAsync`).
8. Enviar el correo dentro de `try/catch`. Si lanza: `_logger.LogError(...)` y
   devolver `MailFailed` **sin deshacer** la invitación (el dueño puede reenviar).
   Si va bien → `Success` con el `InvitationResponse`.

**`GetInvitationsAsync(Guid projectId, Guid userId)`**
→ `ProjectInvitationResult<List<InvitationResponse>>`

Solo el dueño. Devuelve las invitaciones del proyecto con estado derivado
(`Pending` vencida se reporta como `"EXPIRED"`), ordenadas por `CreatedAt` descendente.
Lectura con `AsNoTracking()` + `Select` directo al DTO.

**`RevokeAsync(Guid projectId, Guid invitationId, Guid userId)`**
→ `ProjectInvitationResult<object>`

Solo el dueño. Solo invitaciones `Pending`; si ya está `Accepted` → `Conflict`
(para quitar a un miembro hace falta otra funcionalidad, fuera de alcance).
Marca `Status = Revoked`.

**`ResendAsync(Guid projectId, Guid invitationId, Guid userId)`**
→ `ProjectInvitationResult<InvitationResponse>`

Solo el dueño, solo `Pending`. Genera **token nuevo** (el anterior deja de
servir), reinicia `ExpiresAt` y vuelve a enviar el correo. Mismo manejo de
`MailFailed`.

**`GetByTokenAsync(string token, Guid userId)`**
→ `ProjectInvitationResult<InvitationPreviewResponse>`

Alimenta la pantalla de aceptación. Busca por hash:

- no existe → `NotFound`
- `Revoked`, o `Pending` vencida → `Expired`
- `Accepted` → `Success` con `status: "ACCEPTED"` (la pantalla ofrece "Ir al proyecto")
- el correo del `User` autenticado ≠ `Email` de la invitación → `EmailMismatch`
  (devolviendo igualmente el correo esperado, para poder decir "esta invitación
  es para otra dirección"). La comparación es
  `string.Equals(userEmail, invitation.Email, StringComparison.OrdinalIgnoreCase)`:
  el correo de la invitación se guarda en minúsculas, pero el que viene de Google
  en `User.Email` no está normalizado. *(Decisión del diseñador, no discutida.)*
- en otro caso → `Success` con nombre del proyecto, nombre de quien invita y rol

**`AcceptAsync(string token, Guid userId)`**
→ `ProjectInvitationResult<AcceptInvitationResponse>`

1. Repetir todas las validaciones de `GetByTokenAsync` (no confiar en que la
   pantalla ya las hizo).
   - Si el proyecto se archivó entre la invitación y la aceptación, **se acepta
     igual**: el `ProjectMember` se crea y `CanWrite` ya impide escribir mientras
     `IsArchived` sea `true`. No hace falta un estado de error nuevo.
     *(Decisión del diseñador, no discutida.)*
2. Si ya es miembro del proyecto: marcar la invitación como `Accepted` y
   devolver `Success` — idempotente, no `Conflict`. Un doble clic no debe fallar.
3. En transacción (`BeginTransactionAsync`, como `CreateOwnedProjectAsync`):
   crear `new ProjectMember(projectId, userId, role)`, marcar la invitación
   `Accepted` con `AcceptedAt` y `AcceptedByUserId`, actualizar
   `Project.UpdatedAt`, commit.
4. Devolver `{ projectId, projectName, role }` para que el frontend navegue al editor.

#### Cuerpo del correo

Método privado en el servicio, al estilo de `BuildBody` de la referencia:

```csharp
private string BuildInvitationBody(string projectName, string inviterName, Roles role, string link)
{
    var roleText = role == Roles.Editor ? "editar" : "ver";
    return $@"
    <h3>Te invitaron a un proyecto</h3>
    <p><strong>{inviterName}</strong> te invitó a <strong>{projectName}</strong>
       con permiso para <strong>{roleText}</strong>.</p>
    <p><a href='{link}'>Aceptar la invitación</a></p>
    <p><small>El enlace caduca en 7 días. Si no esperabas este correo, ignóralo.</small></p>
    ";
}
```

- Asunto: `$"Invitación para colaborar en {projectName}"`.
- Enlace: `$"{_frontendOptions.BaseUrl}/invitations/{token}"`.
- **Escapar el HTML** de `projectName` e `inviterName` antes de interpolarlos
  (`System.Net.WebUtility.HtmlEncode`): son texto que escribe el usuario y acaban
  en un documento HTML. La referencia no lo hace; aquí sí, es un proyecto de
  seguridad.

### 5.5 Retorno al login (cambio transversal necesario)

**El problema:** si el invitado no tiene sesión, `authGuard` lo manda a `/login`,
y `AuthController.Login` tiene el destino fijo:

```csharp
RedirectUri = $"{_frontendOptions.BaseUrl}/projects"
```

El token se pierde y el enlace del correo no sirve para quien no estaba logueado,
que es justo el caso principal.

**La solución:** `GET /auth/login` acepta un `returnUrl` opcional.

```csharp
[HttpGet("login")]
public IActionResult Login([FromQuery] string? returnUrl = null)
{
    var target = IsSafeReturnUrl(returnUrl) ? returnUrl! : "/projects";
    var properties = new AuthenticationProperties
    {
        RedirectUri = $"{_frontendOptions.BaseUrl}{target}"
    };
    return Challenge(properties, GoogleDefaults.AuthenticationScheme);
}

/// <summary>
/// Solo se acepta una ruta relativa del propio frontend. Rechaza URLs absolutas
/// y las que empiezan con "//" o "/\", que los navegadores tratan como
/// protocol-relative y permitirían un open redirect.
/// </summary>
private static bool IsSafeReturnUrl(string? returnUrl) =>
    !string.IsNullOrWhiteSpace(returnUrl)
    && returnUrl.StartsWith('/')
    && !returnUrl.StartsWith("//")
    && !returnUrl.StartsWith("/\\");
```

En el frontend, `authGuard` pasa la ruta actual:

```ts
const returnUrl = state.url;   // CanActivateFn recibe (route, state)
return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
```

y `google-auth-button` añade `?returnUrl=...` (codificado con
`encodeURIComponent`) cuando lo recibe como input. La validación del servidor es
la que cuenta; la del cliente es comodidad.

### 5.6 Capa Presentation

**`Presentation/Dtos/Requests/CreateInvitationRequest.cs`**

```csharp
public class CreateInvitationRequest
{
    [Required] public string Email { get; set; } = string.Empty;
    [Required] public string Role { get; set; } = string.Empty;   // "EDITOR" | "VIEWER"
}
```

**`Presentation/Dtos/Responses/InvitationResponse.cs`**

```csharp
public class InvitationResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;    // "EDITOR" | "VIEWER"
    public string Status { get; set; } = string.Empty;  // "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
```

**`Presentation/Dtos/Responses/InvitationPreviewResponse.cs`**

```csharp
public class InvitationPreviewResponse
{
    public string ProjectName { get; set; } = string.Empty;
    public string InvitedByName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;   // a quién va dirigida
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
```

**`Presentation/Dtos/Responses/AcceptInvitationResponse.cs`**

```csharp
public class AcceptInvitationResponse
{
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
```

Todos los enums salen como **strings en mayúsculas**, igual que `ProjectResponse.Role`.

**`Presentation/Controllers/ProjectInvitationsController.cs`**
`[ApiController] [Authorize] [Route("projects/{projectId:guid}/invitations")]`

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/` | `GetInvitations` |
| `POST` | `/` | `Invite` → `CreatedAtAction` |
| `POST` | `/{invitationId:guid}/resend` | `Resend` |
| `DELETE` | `/{invitationId:guid}` | `Revoke` → `NoContent` |

**`Presentation/Controllers/InvitationsController.cs`**
`[ApiController] [Authorize] [Route("invitations")]`

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/{token}` | `GetInvitation` |
| `POST` | `/{token}/accept` | `Accept` |

El token va como segmento de ruta; al ser Base64Url no necesita escaparse.

Ambos controllers usan el helper ya canónico y **nada más**:

```csharp
private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
    User.FindFirstValue(AuthClaimTypes.UserId), out userId);
```

#### Mapeo de estados a status codes

| Estado | HTTP | Cuerpo |
|---|---|---|
| `Success` | 200 / 201 / 204 | el DTO, o vacío |
| `Invalid` | 400 | `{ error = "..." }` |
| `Forbidden` | 403 | `Forbid()` |
| `NotFound` | 404 | `{ error = "La invitación no existe." }` |
| `Conflict` | 409 | `{ error = "..." }` |
| `Expired` | 410 Gone | `{ error = "La invitación ya no es válida." }` |
| `EmailMismatch` | 403 | `{ error = "Esta invitación es para <correo>." }` |
| `MailFailed` | 502 Bad Gateway | `{ error = "La invitación se creó pero no se pudo enviar el correo." }` |

El cuerpo de `MailFailed` lleva **solo** `error`, aunque la invitación sí se haya
creado. El frontend vuelve a pedir la lista de invitaciones después de cada
intento (con éxito o con fallo), así que la invitación recién creada aparece ahí
con su `id` y el dueño puede pulsar "reenviar" sin necesitar nada más en esta
respuesta. *(Decisión del diseñador, no discutida.)*

> `NotFound` aquí **no** viola la regla de "ajeno → 403": un token inexistente no
> revela nada sobre ningún proyecto. La regla sigue vigente para
> `/projects/{id}/...`, donde el no-miembro recibe 403.

Registrar el servicio en `Config/ServicesConfig.cs`:

```csharp
services.AddScoped<ProjectInvitationService>();
```

### 5.7 Frontend

Feature nueva `src/app/features/collaboration/`, con la estructura estándar:

```text
features/collaboration/
├── models/invitation.interface.ts
├── data-access/invitation.service.ts
├── components/
│   ├── invitation-form/          # correo + selector de rol; emite el alta
│   └── invitation-list/          # pendientes, con revocar y reenviar
│                                 # (el formulario avisa, sin bloquear, que el
│                                 #  invitado necesita una cuenta de Google)
└── pages/
    └── invitation-accept/        # pantalla del enlace del correo
```

**`models/invitation.interface.ts`** — uniones literales que espejan al backend:

```ts
export type InvitationRole = 'EDITOR' | 'VIEWER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface InvitationResponse { id: string; email: string; role: InvitationRole;
  status: InvitationStatus; createdAt: string; expiresAt: string; }
export interface CreateInvitationRequest { email: string; role: InvitationRole; }
export interface InvitationPreviewResponse { projectName: string; invitedByName: string;
  email: string; role: InvitationRole; status: InvitationStatus; }
export interface AcceptInvitationResponse { projectId: string; projectName: string; role: InvitationRole; }
```

**`data-access/invitation.service.ts`** — `@Injectable({ providedIn: 'root' })`,
con **el mismo helper privado `request<T>()`** que `project.service.ts` y
`project-file.service.ts` (copiarlo tal cual: `credentials: 'include'`,
`Content-Type: application/json`, lectura de `{ error }`/`{ title }`, `204` →
`undefined`).

**`core/constants/api.constants.ts`** — añadir, con `encodeURIComponent`:

```ts
projects: {
  // …
  invitations: {
    root: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/invitations`,
    byId: (projectId: string, invitationId: string) =>
      `/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}`,
    resend: (projectId: string, invitationId: string) =>
      `/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
  },
},
invitations: {
  byToken: (token: string) => `/invitations/${encodeURIComponent(token)}`,
  accept: (token: string) => `/invitations/${encodeURIComponent(token)}/accept`,
},
```

**Ruta nueva** en `app.routes.ts`, hermana de `login` y `editor/:projectId`
(fuera de `AppLayoutComponent`, porque es una pantalla de llegada sin el sidebar):

```ts
{
  path: 'invitations/:token',
  component: InvitationAcceptComponent,
  canActivate: [authGuard],
},
```

El guard es el que provoca el viaje al login con `returnUrl` (§5.5), y al volver
el usuario cae en esta misma URL.

**Punto de entrada para invitar.** Acción nueva `'share'` en
`ProjectActionMenuComponent`:

- `export type ProjectAction = 'duplicate' | 'download' | 'export-pdf' | 'share' | 'edit' | 'archive' | 'delete';`
- Botón con icono `LucideUserPlus`, dentro del bloque `@if (canManage())`
  (solo el dueño), con `app-ui-tooltip text="Compartir"` y `aria-label="Compartir"`,
  siguiendo literalmente el formato de los botones que ya están ahí.

`ProjectListComponent` maneja `'share'` abriendo un `app-ui-modal` titulado
"Compartir proyecto" que contiene `invitation-form` + `invitation-list`. Estado
nuevo en signals, al estilo del que ya tiene:
`shareDialogOpen`, `invitations`, `isInviting`, `inviteError`.

**Pantalla de aceptación** (`invitation-accept`): al construirse pide el preview
por token y según `status` muestra uno de estos estados, cada uno en su rama `@if`:

| Situación | Qué se ve |
|---|---|
| cargando | `app-ui-loading` |
| `PENDING` válida | nombre del proyecto, quién invita, rol, y botón "Aceptar invitación" |
| aceptando | botón deshabilitado |
| aceptada con éxito | navega a `/editor/:projectId` |
| `ACCEPTED` previa | "Ya aceptaste esta invitación" + enlace al editor |
| `EXPIRED` / `REVOKED` (410) | "Esta invitación ya no es válida. Pídele al dueño que te invite de nuevo." |
| `EmailMismatch` (403) | "Esta invitación es para `<correo>`. Entraste con otra cuenta." + opción de cerrar sesión |
| `NotFound` (404) | "No encontramos esta invitación." |

Los componentes de `components/` son **tontos**: reciben `input()` y emiten
`output()`; el que inyecta `InvitationService` y guarda el estado es la página
(`invitation-accept`) o el contenedor (`project-list`). Reutilizar
`ui-modal`, `ui-form-field`, `ui-modal-actions`, `ui-empty-state`, `ui-loading`,
`ui-status-badge` y `ui-tooltip`; no crear componentes `ui-*` nuevos salvo que
haga falta de verdad. Colores desde los tokens de `styles.css`, verificado en
claro y oscuro. CSS de cada componente por debajo de 4 kB.

---

## 6. Verificación

No hay suite de pruebas automatizadas en el repositorio (el backend no tiene
proyecto de test y el frontend solo trae el `app.spec.ts` por defecto), así que la
verificación es manual y **debe ejecutarse de verdad**, no asumirse:

1. `dotnet build` sin errores ni warnings nuevos de nulabilidad.
2. `pnpm build` sin superar los presupuestos de tamaño.
3. Con dos cuentas de Google distintas (A dueña, B invitada):
   - A invita a B como `Viewer`; B recibe el correo.
   - B abre el enlace **sin sesión**: pasa por Google y vuelve a la pantalla de
     aceptación, no a `/projects`.
   - B acepta; el proyecto le aparece en `/projects/shared` y lo abre en el editor.
   - B como `Viewer` **no** puede guardar: el backend responde 403 al `PUT` de
     contenido (comprobarlo en la red, no solo que el botón esté gris).
   - Repetir con `Editor` y confirmar que sí puede guardar y recompilar.
4. Casos de error, uno por uno: token manipulado (404), invitación revocada (410),
   invitación vencida —cambiando `ExpiresAt` a mano en la base— (410), enlace
   abierto con otra cuenta (403 con el correo esperado), segundo clic en "Aceptar"
   (sigue funcionando, idempotente), invitar a quien ya es miembro (409).
5. Intento de escalada: `POST` con `{"role":"OWNER"}` desde la consola del
   navegador o Swagger → 400.
6. Open redirect: `GET /api/auth/login?returnUrl=https://ejemplo.com` y
   `returnUrl=//ejemplo.com` → acaba en `/projects`, nunca en el sitio externo.

---

## 7. Orden de implementación sugerido

De adentro hacia afuera, como manda `backend/README.md`:

1. `INotifier` + `EmailNotifier` + `MailConfig` + `Program.cs` + `appsettings.json`
   + `.env`. **Probar el envío aislado antes de seguir** (un endpoint temporal o
   un `curl` a algo que llame a `SendAsync`); si Gmail no autentica, es mejor
   descubrirlo aquí y no al final.
2. `InvitationStatus`, `ProjectInvitation`, colección en `Project`, mapeo en
   `AppDatabase`, migración.
3. `ProjectInvitationService` completo + registro en `ServicesConfig`.
4. DTOs y los dos controllers.
5. `returnUrl` en `AuthController` (§5.5).
6. `API_ROUTES`, `invitation.service.ts`, modelos.
7. `invitation-accept` + ruta + `returnUrl` en `authGuard` y `google-auth-button`.
8. Acción `share`, modal, `invitation-form`, `invitation-list`.
9. Actualizar la sección 9 ("Pendientes") de los dos READMEs y `TODO.md`.

---

## 8. Decisiones que quedan al constructor

- Nombres exactos de los métodos privados y el orden interno de las validaciones,
  mientras se respete la tabla de estados de §5.6.
- Maquetación y CSS concretos de las tres piezas de interfaz nuevas.
- Textos exactos de los mensajes, siempre en español y con el tono de los que ya
  existen ("No fue posible completar la operación.").
- Si `invitation-list` se reutiliza también dentro del editor (no es necesario).
- Si el modal de compartir muestra además los miembros ya aceptados; si lo hace,
  basta con derivarlos de las invitaciones `ACCEPTED`, sin endpoint nuevo.

---

## 9. Lo que esto deja preparado

Al terminar, `project_members` por fin tiene filas con rol `Editor` y `Viewer`
creadas por el flujo normal, que es lo que la colaboración en tiempo real
necesita para saber quién puede escribir. El `canEdit` del `EditorLayoutComponent`
y el `CanWrite` de `ProjectFileService` ya contemplan esos roles: no hay que
tocarlos.
