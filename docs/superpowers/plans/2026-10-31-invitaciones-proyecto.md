# Invitaciones a proyectos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño de un proyecto invita a alguien por correo electrónico como editor o lector; el invitado acepta el enlace y obtiene acceso real al proyecto.

**Architecture:** Tabla `project_invitations` que guarda el **hash** de un token opaco y el correo invitado. El correo sale por SMTP real de Gmail con un enlace a `/invitations/:token` en Angular; esa pantalla exige sesión de Google y llama a `POST /invitations/{token}/accept`, que crea el `ProjectMember`. Se respeta la arquitectura en capas existente (Presentation → App → Domain, con Data e Infrastructure) sin introducir patrones nuevos.

**Tech Stack:** .NET 8 / ASP.NET Core, EF Core 8 + Npgsql, MailKit 4.15.1, Angular 22 (standalone + signals + `fetch`), PrimeNG 22, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-31-invitaciones-proyecto-design.md` — leerlo completo antes de empezar. El plan argumenta desde el spec; los dos viajan juntos.

**Lectura previa obligatoria:** `backend/README.md` y `frontend/README.md`. Documentan las convenciones que este plan da por sabidas (primary constructors, patrón enum+record, `AsNoTracking()`+`Select`, `@if`/`@for`, `input()`/`output()`, `fetch` con `credentials: 'include'`).

## Sobre la verificación

**Este repositorio no tiene pruebas automatizadas**: el backend no tiene proyecto de test y el frontend solo trae el `app.spec.ts` que genera el CLI. El spec aprobado (§6) fija verificación manual. Por eso los pasos de verificación de este plan son **comandos concretos con resultado comprobable** (`dotnet build`, `psql`, `curl -i`, `fetch` desde la consola del navegador) en lugar del ciclo test-falla / test-pasa. No es un descuido: es la realidad del proyecto. Ningún paso se puede marcar como hecho sin haber ejecutado su comando y visto su salida.

Para los pasos autenticados se usa la consola de DevTools del navegador con una sesión ya abierta, porque la autenticación es una cookie `HttpOnly` emitida por el flujo de Google y no se puede reproducir con `curl` a mano.

---

## Global Constraints

Valores copiados literalmente del spec. Aplican a **todas** las tareas.

- **Paquete:** `MailKit` versión `4.15.1`. No añadir `SendWithAttachmentAsync` al contrato: `INotifier` se queda en `SendAsync(string to, string subject, string body)`.
- **SMTP:** `smtp.gmail.com`, puerto `587`, `SecureSocketOptions.StartTls`. Credenciales en `MAIL_USER` / `MAIL_PASSWORD` (variables de entorno, nunca en `appsettings.json`). Requiere contraseña de aplicación de Google (cuenta con 2FA).
- **Token:** 32 bytes de `RandomNumberGenerator.GetBytes(32)`, codificados con `WebEncoders.Base64UrlEncode`. Se persiste **solo** `SHA256(token)` en hexadecimal minúsculas. El token en claro nunca se guarda ni se devuelve en ninguna respuesta.
- **Vigencia:** `ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)`.
- **Roles invitables:** únicamente `"EDITOR"` y `"VIEWER"` (comparación case-insensitive). `"OWNER"` o cualquier otro valor → `Invalid` → 400. La validación es del backend, nunca del frontend.
- **Solo el dueño invita**, lista, revoca y reenvía. Un `Editor` no puede.
- **`InvitationStatus.Expired` no se persiste**: se deriva de `ExpiresAt` al leer.
- **El enlace vale solo para el correo invitado.** Comparación con `string.Equals(userEmail, invitation.Email, StringComparison.OrdinalIgnoreCase)`.
- **Se permite invitar cualquier dominio de correo.** No filtrar por `@gmail.com`.
- **Enums hacia el cliente como strings en MAYÚSCULAS:** `"EDITOR"`, `"VIEWER"`, `"PENDING"`, `"ACCEPTED"`, `"REVOKED"`, `"EXPIRED"`.
- **Mapeo de estados a HTTP** (tabla del spec §5.6, sin desviaciones): `Success`→200/201/204, `Invalid`→400, `Forbidden`→403 (`Forbid()`), `NotFound`→404, `Conflict`→409, `Expired`→410, `EmailMismatch`→403, `MailFailed`→502. Cuerpos de error siempre `new { error = "mensaje en español" }`.
- **Un proyecto ajeno sigue devolviendo 403, nunca 404.** La excepción es un token inexistente (404), que no revela nada de ningún proyecto.
- **`userId` siempre del claim** `AuthClaimTypes.UserId`, vía el helper `TryGetCurrentUserId`. Nunca de la ruta, query o body.
- **Textos de interfaz y de error en español**, con el tono de los existentes ("No fue posible completar la operación.").
- **Frontend:** sin `HttpClient` ni RxJS. Miembros reactivos `readonly`. CSS de cada componente por debajo de **4 kB**. Colores solo desde los tokens de `src/styles.css`, verificados en claro y oscuro.
- **Nombres de archivo sin sufijo `.component`**: `invitation-accept.ts` → `class InvitationAcceptComponent`.

---

## Review Focus

Clases de entrada que el spec implica y que conviene verificar explícitamente, de más a menos probable que muerdan a un usuario real. Cada una tiene su paso de verificación en la tarea que posee el código.

1. **Correo con mayúsculas o espacios al invitar** (`"  Ana@Gmail.COM "`): debe normalizarse al guardar y seguir casando al aceptar, o la invitación queda inaceptable para siempre. → Tarea 3 y Tarea 5.
2. **Token manipulado, truncado o con caracteres fuera de Base64Url en la URL**: debe dar 404 limpio, nunca 500 ni excepción sin capturar. → Tarea 5.
3. **Nombre de proyecto con HTML** (`Tesis <b>final</b> & más`): debe llegar escapado al correo, no interpretado. → Tarea 3.
4. **`returnUrl` apuntando fuera del sitio** (`https://ejemplo.com`, `//ejemplo.com`, `/\ejemplo.com`): debe caer a `/projects`. → Tarea 6.
5. **Segundo clic en "Aceptar"** (o enlace abierto dos veces): debe seguir funcionando sin error y sin crear una membresía duplicada. → Tarea 5.

---

## Estructura de archivos

**Backend — crear:**

| Archivo | Responsabilidad |
|---|---|
| `Domain/Services/INotifier.cs` | Contrato de envío de notificaciones |
| `Domain/Enums/InvitationStatus.cs` | `Pending`, `Accepted`, `Revoked` |
| `Domain/Models/ProjectInvitation.cs` | Entidad de invitación |
| `Infrastructure/Mail/EmailNotifier.cs` | Implementación SMTP con MailKit |
| `Config/MailConfig.cs` | `AddMailer()` |
| `App/Projects/ProjectInvitationService.cs` | Lógica y autorización de invitaciones |
| `Presentation/Dtos/Requests/CreateInvitationRequest.cs` | |
| `Presentation/Dtos/Responses/InvitationResponse.cs` | |
| `Presentation/Dtos/Responses/InvitationPreviewResponse.cs` | |
| `Presentation/Dtos/Responses/AcceptInvitationResponse.cs` | |
| `Presentation/Controllers/ProjectInvitationsController.cs` | Rutas del dueño |
| `Presentation/Controllers/InvitationsController.cs` | Rutas del invitado |

**Backend — modificar:** `backend.csproj`, `appsettings.json`, `.env`, `Program.cs`, `Config/ServicesConfig.cs`, `Data/Database/AppDatabase.cs`, `Domain/Models/Project.cs`, `Presentation/Controllers/AuthController.cs`.

**Frontend — crear:**

| Archivo | Responsabilidad |
|---|---|
| `features/collaboration/models/invitation.interface.ts` | Tipos del contrato |
| `features/collaboration/data-access/invitation.service.ts` | Llamadas HTTP |
| `features/collaboration/pages/invitation-accept/{ts,html,css}` | Pantalla del enlace |
| `features/collaboration/components/invitation-form/{ts,html,css}` | Correo + rol (tonto) |
| `features/collaboration/components/invitation-list/{ts,html,css}` | Pendientes (tonto) |

**Frontend — modificar:** `core/constants/api.constants.ts`, `core/auth/auth.guard.ts`, `features/auth/components/google-auth-button/{ts,html}`, `app.routes.ts`, `features/projects/components/project-action-menu/{ts,html}`, `features/projects/pages/project-list/{ts,html}`.

---

## Task 1: Infraestructura de correo

Deliverable independiente: la aplicación arranca con el mailer registrado y **se envía un correo de verdad por Gmail**. Se verifica aislado antes de construir nada encima: si Gmail no autentica, hay que descubrirlo aquí.

**Files:**
- Create: `backend/Domain/Services/INotifier.cs`
- Create: `backend/Infrastructure/Mail/EmailNotifier.cs`
- Create: `backend/Config/MailConfig.cs`
- Modify: `backend/backend.csproj` (bloque `<ItemGroup>` de paquetes)
- Modify: `backend/appsettings.json` (sección `MailSettings`)
- Modify: `backend/.env` (dos claves nuevas)
- Modify: `backend/Program.cs` (lectura de variables + `.AddMailer(...)` en la cadena)

**Interfaces:**
- Consumes: nada.
- Produces: `INotifier.SendAsync(string to, string subject, string body) : Task`, resoluble por DI con ámbito `Scoped`. `MailConfig.AddMailer(this IServiceCollection, IConfiguration, string user, string password) : IServiceCollection`.

- [ ] **Step 1: Añadir el paquete MailKit**

En `backend.csproj`, dentro del `<ItemGroup>` existente, con comentario al estilo de los demás:

```xml
<!-- Envío de correo -->
<PackageReference Include="MailKit" Version="4.15.1" />
```

Luego `dotnet restore`.

- [ ] **Step 2: Crear `INotifier` y `EmailNotifier`**

El código de ambos está en el spec §5.1, listo para copiar. `EmailNotifier` usa primary constructor con `(string smtpDomain, int port, string user, string password)` y reasigna a campos `private readonly _camelCase`.

- [ ] **Step 3: Crear `MailConfig.AddMailer`**

Código en el spec §5.1. Lee `MailSettings:Domain` y `MailSettings:Port` de la configuración, recibe usuario y contraseña por parámetro, registra `INotifier` como `Scoped`, y lanza `InvalidOperationException` si usuario o contraseña vienen vacíos (mismo criterio que `AuthConfig`).

- [ ] **Step 4: Añadir la configuración y las variables de entorno**

En `appsettings.json`, al nivel de `Logging`:

```json
"MailSettings": {
  "Domain": "smtp.gmail.com",
  "Port": 587
}
```

En `backend/.env` (ya está en `.gitignore`, **no se commitea**):

```
MAIL_USER=tucuenta@gmail.com
MAIL_PASSWORD=<contraseña de aplicación de 16 caracteres, sin espacios>
```

- [ ] **Step 5: Encadenar `AddMailer` en `Program.cs`**

Leer las dos variables junto a las existentes y encadenar `.AddMailer(builder.Configuration, MAIL_USER, MAIL_PASSWORD)` antes de `.AddAuth(...)`. El orden exacto está en el spec §5.1.

- [ ] **Step 6: Verificar que compila y arranca**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`, sin warnings nuevos.

Run: `dotnet run`
Expected: arranca sin lanzar la excepción de configuración faltante.

- [ ] **Step 7: Verificar un envío real, con un endpoint temporal**

Añadir temporalmente a `AuthController` (se borra en el Step 9):

```csharp
[HttpGet("mail-test")]
[Authorize]
public async Task<IActionResult> MailTest([FromServices] INotifier notifier)
{
    await notifier.SendAsync("tu-otro-correo@ejemplo.com", "Prueba", "<p>Funciona</p>");
    return Ok();
}
```

Con sesión abierta en el navegador, desde la consola de DevTools:

```js
await fetch('/api/auth/mail-test', { credentials: 'include' }).then(r => r.status)
```

Expected: `200`, y el correo llega a la bandeja de entrada.

Si da 500 con `AuthenticationInvalidCredentials`: la contraseña no es una contraseña de aplicación, o la cuenta no tiene 2FA. Resolverlo aquí antes de continuar.

- [ ] **Step 8: Verificar el fallo de configuración**

Comentar `MAIL_PASSWORD` en `.env` y `dotnet run`.
Expected: no arranca; lanza `InvalidOperationException` mencionando `MAIL_USER` y `MAIL_PASSWORD`. Restaurar la clave después.

- [ ] **Step 9: Borrar el endpoint temporal y commitear**

```bash
git add backend/backend.csproj backend/appsettings.json backend/Program.cs \
        backend/Domain/Services/INotifier.cs \
        backend/Infrastructure/Mail/EmailNotifier.cs \
        backend/Config/MailConfig.cs
git commit -m "feat: agregar infraestructura de envio de correo con MailKit"
```

Confirmar que `backend/.env` **no** aparece en el commit (`git show --stat HEAD`).

---

## Task 2: Modelo de datos de invitaciones

Deliverable: la tabla `project_invitations` existe en la base con sus índices y restricciones.

**Files:**
- Create: `backend/Domain/Enums/InvitationStatus.cs`
- Create: `backend/Domain/Models/ProjectInvitation.cs`
- Modify: `backend/Domain/Models/Project.cs` (colección inversa)
- Modify: `backend/Data/Database/AppDatabase.cs` (`DbSet` + `OnModelCreating`)
- Create: `backend/Data/Migrations/<timestamp>_AddProjectInvitations.cs` (generada)

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `AppDatabase.ProjectInvitations` (`DbSet<ProjectInvitation>`). Entidad `ProjectInvitation` con primary constructor `(Guid projectId, string email, Roles role, string tokenHash, Guid invitedById, DateTimeOffset expiresAt)` y propiedades `Id, ProjectId, Email, Role, TokenHash, InvitedById, Status, CreatedAt, ExpiresAt, AcceptedAt, AcceptedByUserId`, más las navegaciones `Project` e `InvitedBy`. `Project.Invitations` (`ICollection<ProjectInvitation>`).

- [ ] **Step 1: Crear el enum y la entidad**

Código completo en el spec §5.2. Respetar los comentarios XML sobre la normalización del correo y sobre que `TokenHash` guarda el SHA-256.

- [ ] **Step 2: Añadir la colección inversa en `Project`**

```csharp
public ICollection<ProjectInvitation> Invitations { get; set; } = [];
```

- [ ] **Step 3: Registrar el `DbSet` y el mapeo en `AppDatabase`**

Bloque `modelBuilder.Entity<ProjectInvitation>(...)` completo en el spec §5.2. Incluye: tabla `project_invitations`, `Role` y `Status` como string con `HasMaxLength(16)`, `TokenHash` requerido con `HasMaxLength(64)`, **índice único** en `TokenHash`, índice compuesto en `(ProjectId, Email, Status)`, FK a `Project` en `Cascade` y FK a `InvitedBy` en `Restrict`.

- [ ] **Step 4: Generar la migración**

Run: `cd backend && dotnet ef migrations add AddProjectInvitations`
Expected: se crean los tres archivos en `Data/Migrations/` y el snapshot se actualiza. Revisar el `Up()` generado: debe crear la tabla con las dos FK y los dos índices, y **no** debe tocar ninguna tabla existente salvo para nada.

- [ ] **Step 5: Aplicar y verificar el esquema**

Run: `dotnet run` (aplica migraciones al arrancar), luego parar.

Run (ajustando las credenciales a las de `CONNECTION_STRING`):
```bash
psql "$CONNECTION_STRING_PSQL" -c '\d project_invitations'
```
Expected: la tabla existe; `token_hash` es `character varying(64) not null` con índice único; `role` y `status` son `character varying(16) not null`; hay FK a `projects` con `ON DELETE CASCADE` y a `users` con `ON DELETE NO ACTION`/`RESTRICT`.

- [ ] **Step 6: Commitear**

```bash
git add backend/Domain backend/Data
git commit -m "feat: agregar entidad y tabla de invitaciones de proyecto"
```

---

## Task 3: Crear y enviar una invitación

Deliverable: `POST /projects/{id}/invitations` crea la invitación y envía el correo con el enlace.

**Files:**
- Create: `backend/App/Projects/ProjectInvitationService.cs`
- Create: `backend/Presentation/Dtos/Requests/CreateInvitationRequest.cs`
- Create: `backend/Presentation/Dtos/Responses/InvitationResponse.cs`
- Create: `backend/Presentation/Controllers/ProjectInvitationsController.cs`
- Modify: `backend/Config/ServicesConfig.cs`

**Interfaces:**
- Consumes: `INotifier.SendAsync` (Tarea 1); `AppDatabase.ProjectInvitations` y la entidad `ProjectInvitation` (Tarea 2); `FrontendOptions` vía `IOptions<FrontendOptions>` (ya registrado en `Config/AuthConfig.cs`).
- Produces:
  - `enum ProjectInvitationResultStatus { Success, Forbidden, Invalid, Conflict, NotFound, Expired, EmailMismatch, MailFailed }`
  - `record ProjectInvitationResult<T>(ProjectInvitationResultStatus Status, T? Value = default)`
  - `ProjectInvitationService(AppDatabase database, INotifier notifier, IOptions<FrontendOptions> frontendOptions, ILogger<ProjectInvitationService> logger)`
  - `Task<ProjectInvitationResult<InvitationResponse>> InviteAsync(Guid projectId, Guid userId, CreateInvitationRequest request)`
  - DTOs `CreateInvitationRequest { string Email; string Role; }` e `InvitationResponse { Guid Id; string Email; string Role; string Status; DateTimeOffset CreatedAt; DateTimeOffset ExpiresAt; }`

- [ ] **Step 1: Crear los DTOs**

Definiciones exactas en el spec §5.6. `CreateInvitationRequest` lleva `[Required]` en ambas propiedades.

- [ ] **Step 2: Crear el esqueleto del servicio con el enum, el record y los helpers de token**

El enum y el record están en el spec §5.4. Añadir los dos helpers privados estáticos:

```csharp
private static string GenerateToken();                 // 32 bytes -> Base64UrlEncode
private static string HashToken(string token);         // SHA-256 -> hex minúsculas
```

Registrar en `Config/ServicesConfig.cs`: `services.AddScoped<ProjectInvitationService>();`

- [ ] **Step 3: Implementar `InviteAsync`**

Las ocho validaciones, en orden, están en el spec §5.4. Puntos que no deben perderse:

- La comprobación de propiedad reutiliza la forma de `ProjectService.GetOwnedProjectAsync` (exige `OwnerId == userId` **y** membresía con rol `Owner`) y además rechaza el proyecto archivado.
- El correo se normaliza con `.Trim().ToLowerInvariant()` **antes** de validar y de guardar.
- El rol se acepta solo si es `EDITOR` o `VIEWER`; `OWNER` → `Invalid`.
- El envío va en `try/catch`: si lanza, `_logger.LogError(...)` y se devuelve `MailFailed` **sin deshacer** la invitación ya guardada.

- [ ] **Step 4: Implementar `BuildInvitationBody` con escapado de HTML**

Plantilla exacta en el spec §5.4. El asunto es `$"Invitación para colaborar en {projectName}"` y el enlace `$"{_frontendOptions.BaseUrl}/invitations/{token}"`.

`projectName` e `inviterName` pasan por `System.Net.WebUtility.HtmlEncode` antes de interpolarse. *(Review Focus #3.)*

- [ ] **Step 5: Crear `ProjectInvitationsController` con el `POST`**

`[ApiController] [Authorize] [Route("projects/{projectId:guid}/invitations")]`, constructor con el servicio, y el helper `TryGetCurrentUserId` idéntico al de `ProjectsController`. El `POST` devuelve `CreatedAtAction(nameof(GetInvitations), new { projectId }, invitation)` en éxito, y mapea el resto según la tabla de Global Constraints.

> `GetInvitations` se implementa en la Tarea 4. Para que `CreatedAtAction` resuelva, declarar ya el método `GetInvitations` en este paso devolviendo `Ok(new List<InvitationResponse>())` como marcador, y completarlo en la Tarea 4.

- [ ] **Step 6: Verificar compilación**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`.

- [ ] **Step 7: Verificar el camino feliz**

Con `dotnet run` y sesión de dueño abierta, desde la consola de DevTools (sustituyendo `<PROJECT_ID>` por uno propio):

```js
await fetch('/api/projects/<PROJECT_ID>/invitations', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'otro@ejemplo.com', role: 'VIEWER' }),
}).then(async r => [r.status, await r.json()])
```

Expected: `201` y el `InvitationResponse` con `status: "PENDING"` y `expiresAt` a 7 días. El correo llega con un enlace a `http://localhost:4200/invitations/<token>`.

Expected además: `psql ... -c 'select email, role, status, length(token_hash) from project_invitations'` muestra el correo en minúsculas, `Viewer`, `Pending` y longitud `64`. El token en claro **no** aparece en ninguna columna.

- [ ] **Step 8: Verificar normalización del correo** *(Review Focus #1)*

Repetir el `POST` con `email: '  OTRA@Ejemplo.COM  '`.
Expected: `201`, y en la base la fila guarda `otra@ejemplo.com`.

- [ ] **Step 9: Verificar escapado de HTML** *(Review Focus #3)*

Renombrar un proyecto a `Tesis <b>final</b> & más` y enviar una invitación.
Expected: en el correo recibido se lee literalmente `Tesis <b>final</b> & más`; no aparece en negrita ni se pierde el `&`.

- [ ] **Step 10: Verificar los rechazos**

Cuatro llamadas, cada una con su resultado:

| Body / situación | Esperado |
|---|---|
| `{ email: 'x@y.com', role: 'OWNER' }` | `400` con `{ error }` |
| `{ email: 'no-es-correo', role: 'VIEWER' }` | `400` |
| el correo del propio dueño | `409` |
| el mismo correo invitado dos veces | `409` la segunda vez |
| un `projectId` de otro usuario | `403` |

- [ ] **Step 11: Commitear**

```bash
git add backend/App backend/Presentation backend/Config/ServicesConfig.cs
git commit -m "feat: crear y enviar invitaciones de proyecto por correo"
```

---

## Task 4: Listar, revocar y reenviar invitaciones

Deliverable: el dueño puede ver sus invitaciones, anularlas y reenviar el correo con un token nuevo.

**Files:**
- Modify: `backend/App/Projects/ProjectInvitationService.cs`
- Modify: `backend/Presentation/Controllers/ProjectInvitationsController.cs`

**Interfaces:**
- Consumes: todo lo producido por la Tarea 3.
- Produces:
  - `Task<ProjectInvitationResult<List<InvitationResponse>>> GetInvitationsAsync(Guid projectId, Guid userId)`
  - `Task<ProjectInvitationResult<object>> RevokeAsync(Guid projectId, Guid invitationId, Guid userId)`
  - `Task<ProjectInvitationResult<InvitationResponse>> ResendAsync(Guid projectId, Guid invitationId, Guid userId)`

- [ ] **Step 1: Implementar `GetInvitationsAsync`**

Solo el dueño (misma comprobación que `InviteAsync`, pero **sin** exigir que el proyecto no esté archivado: consultar debe seguir funcionando). Lectura con `AsNoTracking()` + `Select` directo a `InvitationResponse`, ordenada por `CreatedAt` descendente.

El `Status` se deriva: una invitación `Pending` con `ExpiresAt < UtcNow` se reporta como `"EXPIRED"`. Las demás, el nombre de su estado en mayúsculas.

- [ ] **Step 2: Implementar `RevokeAsync`**

Solo el dueño. Si la invitación no existe o no es de ese proyecto → `NotFound`. Si su estado no es `Pending` → `Conflict`. En otro caso `Status = Revoked` y guardar.

- [ ] **Step 3: Implementar `ResendAsync`**

Solo el dueño, solo invitaciones `Pending` (vencida incluida: reenviar la revive). Genera **token nuevo** —el anterior deja de servir—, reinicia `ExpiresAt` a 7 días, guarda, y reenvía el correo con el mismo manejo de `MailFailed` que `InviteAsync`.

- [ ] **Step 4: Completar el controller**

Sustituir el `GetInvitations` marcador de la Tarea 3 por la implementación real, y añadir `POST /{invitationId:guid}/resend` y `DELETE /{invitationId:guid}` (→ `NoContent()` en éxito). Mapeo según la tabla de Global Constraints.

- [ ] **Step 5: Verificar compilación**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`.

- [ ] **Step 6: Verificar el listado y el estado derivado**

```js
await fetch('/api/projects/<PROJECT_ID>/invitations', { credentials: 'include' })
  .then(async r => [r.status, await r.json()])
```
Expected: `200` con las invitaciones creadas en la Tarea 3, más recientes primero.

Luego, forzar el vencimiento de una en la base:
```bash
psql "$CONNECTION_STRING_PSQL" -c "update project_invitations set expires_at = now() - interval '1 day' where email = 'otro@ejemplo.com'"
```
Expected: el listado ahora devuelve `status: "EXPIRED"` para esa fila, y la columna `status` en la base **sigue** siendo `Pending`.

- [ ] **Step 7: Verificar revocar y reenviar**

- `DELETE` de una invitación `PENDING` → `204`; el listado la muestra como `"REVOKED"`.
- `DELETE` de la misma otra vez → `409`.
- `POST .../resend` de una `PENDING` → `200`, llega un correo nuevo, y `token_hash` cambió en la base (comparar antes y después). El enlace viejo ya no debe aceptarse — se comprueba en la Tarea 5.
- Cualquiera de las tres rutas con un `projectId` ajeno → `403`.

- [ ] **Step 8: Commitear**

```bash
git add backend/App backend/Presentation
git commit -m "feat: listar, revocar y reenviar invitaciones de proyecto"
```

---

## Task 5: Consultar y aceptar una invitación

Deliverable: `GET /invitations/{token}` describe la invitación y `POST /invitations/{token}/accept` crea el `ProjectMember`. Es el corazón de la funcionalidad.

**Files:**
- Modify: `backend/App/Projects/ProjectInvitationService.cs`
- Create: `backend/Presentation/Dtos/Responses/InvitationPreviewResponse.cs`
- Create: `backend/Presentation/Dtos/Responses/AcceptInvitationResponse.cs`
- Create: `backend/Presentation/Controllers/InvitationsController.cs`

**Interfaces:**
- Consumes: todo lo de las Tareas 3 y 4.
- Produces:
  - `Task<ProjectInvitationResult<InvitationPreviewResponse>> GetByTokenAsync(string token, Guid userId)`
  - `Task<ProjectInvitationResult<AcceptInvitationResponse>> AcceptAsync(string token, Guid userId)`
  - DTOs `InvitationPreviewResponse { string ProjectName; string InvitedByName; string Email; string Role; string Status; }` y `AcceptInvitationResponse { Guid ProjectId; string ProjectName; string Role; }`

- [ ] **Step 1: Crear los dos DTOs de respuesta**

Definiciones exactas en el spec §5.6.

- [ ] **Step 2: Implementar `GetByTokenAsync`**

Busca por `HashToken(token)`. La cascada de estados está en el spec §5.4: `NotFound` si no existe; `Expired` si está `Revoked` o es `Pending` vencida; `Success` con `status: "ACCEPTED"` si ya fue aceptada; `EmailMismatch` si el correo de la sesión no casa (devolviendo igualmente el correo esperado, para poder mostrarlo); `Success` en otro caso.

La comparación de correos es `StringComparison.OrdinalIgnoreCase`.

- [ ] **Step 3: Implementar `AcceptAsync`**

Repite **todas** las validaciones de `GetByTokenAsync` (no confiar en la pantalla). Además:

- Si el usuario ya es `ProjectMember`: marcar la invitación `Accepted` y devolver `Success`. **Idempotente, no `Conflict`.** *(Review Focus #5.)*
- Si el proyecto se archivó entremedio: se acepta igual; `CanWrite` ya impide escribir.
- La creación va en transacción (`BeginTransactionAsync` … `CommitAsync`, como `ProjectService.CreateOwnedProjectAsync`): nuevo `ProjectMember(projectId, userId, role)`, invitación a `Accepted` con `AcceptedAt` y `AcceptedByUserId`, y `Project.UpdatedAt = DateTimeOffset.UtcNow`.

- [ ] **Step 4: Crear `InvitationsController`**

`[ApiController] [Authorize] [Route("invitations")]` con `GET /{token}` y `POST /{token}/accept`, el helper `TryGetCurrentUserId`, y el mapeo de la tabla de Global Constraints. En `EmailMismatch` el cuerpo incluye el correo esperado: `new { error = $"Esta invitación es para {preview.Email}." }`.

- [ ] **Step 5: Verificar compilación**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`.

- [ ] **Step 6: Verificar el camino feliz con dos cuentas**

Con la cuenta **B** (la invitada) y el token recibido por correo:

```js
await fetch('/api/invitations/<TOKEN>', { credentials: 'include' })
  .then(async r => [r.status, await r.json()])
```
Expected: `200` con `projectName`, `invitedByName`, el rol y `status: "PENDING"`.

```js
await fetch('/api/invitations/<TOKEN>/accept', { method: 'POST', credentials: 'include' })
  .then(async r => [r.status, await r.json()])
```
Expected: `200` con `{ projectId, projectName, role }`. En la base aparece la fila nueva en `project_members` con el rol correcto, y la invitación queda `Accepted` con `accepted_by_user_id` poblado.

Expected: `GET /api/projects` con la cuenta B ahora incluye el proyecto.

- [ ] **Step 7: Verificar la idempotencia** *(Review Focus #5)*

Repetir el `POST .../accept` con el mismo token.
Expected: `200` otra vez, sin error. `select count(*) from project_members where user_id = '<B>'` no aumentó.

- [ ] **Step 8: Verificar que el correo casa sin importar las mayúsculas** *(Review Focus #1)*

La invitación se guarda en minúsculas, pero `User.Email` viene de Google sin normalizar. Forzar la discrepancia en la base y comprobar que se acepta igual:

```bash
psql "$CONNECTION_STRING_PSQL" -c "update users set email = upper(email) where email = '<correo de B>'"
```

Con una invitación nueva y pendiente para B, hacer el `POST .../accept` con la cuenta B.
Expected: `200`. Si da `403`, la comparación no está usando `StringComparison.OrdinalIgnoreCase`.

Restaurar después: `update users set email = lower(email) where ...`.

- [ ] **Step 9: Verificar tokens inválidos** *(Review Focus #2)*

| Token | Esperado |
|---|---|
| `<TOKEN>` truncado a la mitad | `404` |
| `no-existe-123` | `404` |
| `!!!@@@###` (fuera de Base64Url) | `404`, **nunca 500** |
| el token viejo de la invitación reenviada en la Tarea 4 | `404` |
| una invitación revocada | `410` |
| una invitación vencida (forzada con `psql`) | `410` |

Revisar la consola del servidor: ninguna de estas llamadas debe dejar una excepción sin capturar.

- [ ] **Step 10: Verificar el enlace atado al correo** *(constraint del spec)*

Abrir un token dirigido a la cuenta B estando autenticado como la cuenta A.
Expected: `403` con `{ error: "Esta invitación es para <correo de B>." }`, y **no** se crea ninguna membresía.

- [ ] **Step 11: Verificar los permisos del rol concedido**

Con la cuenta B aceptada como `VIEWER`, intentar guardar contenido:

```js
await fetch('/api/projects/<PROJECT_ID>/files/<FILE_ID>/content', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'intento' }),
}).then(r => r.status)
```
Expected: `403`. Repetir el ciclo invitando como `EDITOR`: entonces `200` y la recompilación funciona.

- [ ] **Step 12: Commitear**

```bash
git add backend/App backend/Presentation
git commit -m "feat: consultar y aceptar invitaciones de proyecto"
```

---

## Task 6: Retorno al login tras el enlace del correo

Deliverable: quien abre el enlace **sin sesión** vuelve a la pantalla de la invitación después de entrar con Google, y no a `/projects`. Sin esto el enlace del correo es inútil para el caso principal.

**Files:**
- Modify: `backend/Presentation/Controllers/AuthController.cs`
- Modify: `frontend/src/app/core/auth/auth.guard.ts`
- Modify: `frontend/src/app/features/auth/components/google-auth-button/google-auth-button.ts`
- Modify: `frontend/src/app/features/auth/components/google-auth-button/google-auth-button.html`

**Interfaces:**
- Consumes: nada de las tareas anteriores.
- Produces: `GET /auth/login?returnUrl=<ruta relativa>`. `GoogleAuthButtonComponent` acepta un input nuevo `returnUrl = input<string | null>(null)`.

- [ ] **Step 1: Añadir `returnUrl` validado a `AuthController.Login`**

Código completo —incluido `IsSafeReturnUrl` y su comentario XML— en el spec §5.5. Rechaza lo que no empiece por `/`, lo que empiece por `//` y lo que empiece por `/\`; en esos casos cae a `/projects`.

- [ ] **Step 2: Verificar la protección contra open redirect** *(Review Focus #4)*

Sin necesidad de sesión, inspeccionando la cabecera `Location` del challenge:

```bash
curl -i 'http://localhost:5282/auth/login?returnUrl=https://ejemplo.com' | grep -i location
curl -i 'http://localhost:5282/auth/login?returnUrl=//ejemplo.com'      | grep -i location
curl -i 'http://localhost:5282/auth/login?returnUrl=/\ejemplo.com'      | grep -i location
curl -i 'http://localhost:5282/auth/login?returnUrl=/invitations/abc123' | grep -i location
```

Expected: en los tres primeros, el `redirect_uri` que viaja a Google lleva el estado apuntando a `/projects`; **en ninguno aparece `ejemplo.com`**. En el cuarto, apunta a `/invitations/abc123`.

- [ ] **Step 3: Pasar la ruta actual desde `authGuard`**

`CanActivateFn` recibe `(route, state)`. Usar `state.url` y redirigir con:

```ts
return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
```

Mantener el comportamiento actual en servidor (`!isPlatformBrowser` → `true`).

- [ ] **Step 4: Propagar `returnUrl` en `google-auth-button`**

Añadir `readonly returnUrl = input<string | null>(null)` y convertir `googleLoginUrl` en un `computed()` que añada `?returnUrl=${encodeURIComponent(...)}` cuando haya valor. La plantilla ya usa `googleLoginUrl`; pasa a invocarlo como signal.

`LoginComponent` lee `returnUrl` de los query params y lo pasa al botón.

- [ ] **Step 5: Verificar el circuito completo en el navegador**

Cerrar sesión. Abrir `http://localhost:4200/invitations/<TOKEN>` (la ruta aún no existe; se añade en la Tarea 7 — por ahora basta con comprobar la redirección a `/login?returnUrl=%2Finvitations%2F<TOKEN>` y que tras entrar con Google el navegador vuelve a esa URL y no a `/projects`).

Run: `cd frontend && pnpm build`
Expected: compila sin errores ni avisos de presupuesto.

- [ ] **Step 6: Commitear**

```bash
git add backend/Presentation/Controllers/AuthController.cs frontend/src/app/core/auth/auth.guard.ts frontend/src/app/features/auth
git commit -m "feat: respetar returnUrl validado al iniciar sesion con Google"
```

---

## Task 7: Pantalla de aceptación en el frontend

Deliverable: el invitado recorre todo el flujo desde el navegador, haciendo clic en el enlace del correo.

**Files:**
- Create: `frontend/src/app/features/collaboration/models/invitation.interface.ts`
- Create: `frontend/src/app/features/collaboration/data-access/invitation.service.ts`
- Create: `frontend/src/app/features/collaboration/pages/invitation-accept/invitation-accept.{ts,html,css}`
- Modify: `frontend/src/app/core/constants/api.constants.ts`
- Modify: `frontend/src/app/app.routes.ts`

**Interfaces:**
- Consumes: los endpoints de las Tareas 3, 4 y 5; el `returnUrl` de la Tarea 6.
- Produces: `InvitationService` con `getInvitations(projectId)`, `invite(projectId, request)`, `revoke(projectId, invitationId)`, `resend(projectId, invitationId)`, `getByToken(token)`, `accept(token)` — todos `Promise`. Tipos de `invitation.interface.ts`. Ruta `invitations/:token`.

- [ ] **Step 1: Crear los modelos**

Contenido exacto en el spec §5.7: `InvitationRole`, `InvitationStatus`, `InvitationResponse`, `CreateInvitationRequest`, `InvitationPreviewResponse`, `AcceptInvitationResponse`.

- [ ] **Step 2: Añadir las rutas a `API_ROUTES`**

Bloques `projects.invitations` e `invitations` del spec §5.7, con `encodeURIComponent` en cada id y en el token.

- [ ] **Step 3: Crear `InvitationService`**

`@Injectable({ providedIn: 'root' })` con los seis métodos de arriba y **el mismo helper privado `request<T>()`** que `project.service.ts` — copiarlo literalmente, incluido `credentials: 'include'`, la lectura de `{ error }` / `{ title }` y el `204 → undefined`.

`getByToken` y `accept` necesitan distinguir el status HTTP para que la pantalla elija el mensaje correcto, y el `request<T>()` heredado lo pierde. Solución fija para ambos: un helper propio que, ante una respuesta no-ok, lanza un error con el status adjunto.

```ts
export interface InvitationError extends Error { status: number; }
```

El helper construye el `Error` con el mensaje del backend (`{ error }` / `{ title }`) y le asigna `status = response.status` antes de lanzarlo. La pantalla hace `catch (error)` y ramifica sobre `(error as InvitationError).status`: `404`, `410`, `403`.

- [ ] **Step 4: Crear `InvitationAcceptComponent`**

`standalone`, selector `app-invitation-accept`, `templateUrl` + `styleUrl`. Inyecta `InvitationService`, `ActivatedRoute` y `Router` con `inject()`. Lee el token de `route.snapshot.paramMap.get('token')`.

Signals: `preview`, `isLoading`, `isAccepting`, `errorMessage`, `errorKind` (para distinguir vencida / otro correo / no encontrada). En el constructor, `void this.loadPreview()`.

La tabla de los ocho estados de interfaz está en el spec §5.7. Cada uno en su rama `@if`, reutilizando `ui-loading`, `ui-empty-state`, `ui-button` y `ui-status-badge`; no crear componentes `ui-*` nuevos.

Al aceptar con éxito: `router.navigate(['/editor', projectId])`.

- [ ] **Step 5: Registrar la ruta**

En `app.routes.ts`, hermana de `login` y `editor/:projectId` (fuera de `AppLayoutComponent`):

```ts
{ path: 'invitations/:token', component: InvitationAcceptComponent, canActivate: [authGuard] },
```

- [ ] **Step 6: Verificar la compilación y los presupuestos**

Run: `cd frontend && pnpm build`
Expected: compila; ningún CSS de componente supera los 4 kB.

- [ ] **Step 7: Verificar el flujo completo del invitado, sin sesión previa**

Cuenta A invita a la cuenta B desde la consola (Tarea 3). En una ventana privada, abrir el enlace del correo tal cual.
Expected, en orden: redirección a Google → vuelta a `/invitations/<token>` → se ve el nombre del proyecto, quién invita y el rol → clic en "Aceptar invitación" → aterriza en `/editor/<projectId>` con el documento cargado → el proyecto aparece en `/projects/shared`.

- [ ] **Step 8: Verificar los estados de error en pantalla**

Uno por uno, comprobando que **se lee un mensaje en español y no una pantalla en blanco ni un error de consola**:

| Situación | Esperado en pantalla |
|---|---|
| token inventado | "No encontramos esta invitación." |
| invitación revocada | "Esta invitación ya no es válida…" |
| invitación vencida (forzada con `psql`) | "Esta invitación ya no es válida…" |
| enlace de B abierto con la cuenta A | "Esta invitación es para `<correo de B>`." |
| volver a abrir un enlace ya aceptado | "Ya aceptaste esta invitación" + enlace al editor |

- [ ] **Step 9: Verificar claro y oscuro**

Alternar el tema con el botón del layout y revisar la pantalla en ambos.
Expected: texto legible y contraste correcto en los dos; ningún color literal fuera de los tokens.

- [ ] **Step 10: Commitear**

```bash
git add frontend/src/app/features/collaboration frontend/src/app/core/constants/api.constants.ts frontend/src/app/app.routes.ts
git commit -m "feat: agregar pantalla de aceptacion de invitaciones"
```

---

## Task 8: Invitar desde la interfaz

Deliverable: el dueño invita, ve las pendientes, revoca y reenvía sin salir de la lista de proyectos. Cierra el circuito: ya no hace falta la consola para nada.

**Files:**
- Create: `frontend/src/app/features/collaboration/components/invitation-form/invitation-form.{ts,html,css}`
- Create: `frontend/src/app/features/collaboration/components/invitation-list/invitation-list.{ts,html,css}`
- Modify: `frontend/src/app/features/projects/components/project-action-menu/project-action-menu.{ts,html}`
- Modify: `frontend/src/app/features/projects/pages/project-list/project-list.{ts,html}`

**Interfaces:**
- Consumes: `InvitationService` y los modelos de la Tarea 7.
- Produces: `ProjectAction` extendido con `'share'`. `InvitationFormComponent` con `input` `isSaving`, `errorMessage` y `output` `invited: { email, role }`. `InvitationListComponent` con `input` `invitations` y `output` `revokeRequested: string`, `resendRequested: string`.

- [ ] **Step 1: Añadir la acción `share` al menú**

En `project-action-menu.ts`, extender el tipo:

```ts
export type ProjectAction = 'duplicate' | 'download' | 'export-pdf' | 'share' | 'edit' | 'archive' | 'delete';
```

En la plantilla, dentro del bloque `@if (canManage())` (solo el dueño), un botón con `LucideUserPlus`, envuelto en `app-ui-tooltip text="Compartir"` y con `aria-label="Compartir"`, siguiendo literalmente el formato de los botones vecinos.

- [ ] **Step 2: Crear `InvitationFormComponent`** (tonto)

Campo de correo y selector de rol (`EDITOR` / `VIEWER`) sobre `ui-form-field`. Emite `invited` con `{ email, role }`. No inyecta servicios.

Incluye un aviso suave, no bloqueante, de que el invitado necesita una cuenta de Google para poder aceptar. *(Decisión de producto del spec §5.)*

Validación local mínima: correo no vacío. El formato real lo valida el backend.

- [ ] **Step 3: Crear `InvitationListComponent`** (tonto)

Recibe `invitations` y renderiza correo, rol, estado (con `ui-status-badge`) y fecha de caducidad. Botones de revocar y reenviar **solo** en las `PENDING` y `EXPIRED`. Con la lista vacía, `ui-empty-state`. No inyecta servicios.

- [ ] **Step 4: Conectar el modal en `ProjectListComponent`**

Signals nuevas: `shareDialogOpen`, `shareProject`, `invitations`, `isInviting`, `inviteError`.

En `handleProjectAction`, rama `'share'`: guarda el proyecto, abre el modal y carga las invitaciones.

Métodos `invite`, `revokeInvitation`, `resendInvitation`: llaman al servicio y **vuelven a pedir la lista después de cada operación**, con éxito o con fallo. Así la invitación creada aparece aunque el correo haya fallado con 502, y el dueño puede reenviarla. *(Decisión del spec §5.6.)*

Los errores van a `inviteError` para que el modal los muestre, como ya hace `errorMessage` en el resto de la página.

En la plantilla, un `app-ui-modal` titulado "Compartir proyecto" con el formulario y la lista dentro.

- [ ] **Step 5: Verificar la compilación y los presupuestos**

Run: `cd frontend && pnpm build`
Expected: compila; ningún CSS de componente supera los 4 kB.

- [ ] **Step 6: Verificar el circuito completo desde la interfaz**

Como dueño: abrir "Compartir" en un proyecto propio, invitar a la cuenta B como `EDITOR`, ver la invitación `PENDING` en la lista. Desde la cuenta B: abrir el correo, aceptar, comprobar que puede editar y guardar.
Expected: todo el recorrido sin tocar la consola.

- [ ] **Step 7: Verificar que el botón no aparece donde no debe**

Abrir `/projects/shared` con la cuenta B, sobre el proyecto que acaba de aceptar.
Expected: el botón "Compartir" no se ve (`canManage()` es falso).

Y confirmar que ocultarlo no es la protección: desde la consola de B,
```js
await fetch('/api/projects/<PROJECT_ID>/invitations', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'tercero@ejemplo.com', role: 'VIEWER' }),
}).then(r => r.status)
```
Expected: `403`.

- [ ] **Step 8: Verificar revocar, reenviar y claro/oscuro**

Revocar una pendiente y ver cómo pasa a `REVOKED`; reenviar otra y confirmar que llega un correo nuevo. Revisar el modal en tema claro y oscuro.

- [ ] **Step 9: Commitear**

```bash
git add frontend/src/app/features
git commit -m "feat: invitar y administrar invitaciones desde la lista de proyectos"
```

---

## Task 9: Documentación

Deliverable: los READMEs y el `TODO.md` describen lo que ahora existe, para que el siguiente agente no reconstruya el contexto desde cero.

**Files:**
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Actualizar `backend/README.md`**

- Sección 1 (Stack): añadir MailKit.
- Sección 2 (árbol): `Infrastructure/Mail/`, `Config/MailConfig.cs`, `App/Projects/ProjectInvitationService.cs`, los dos controllers nuevos, `Domain/Enums/InvitationStatus.cs`, `Domain/Models/ProjectInvitation.cs`.
- Sección 3 (modelo de datos): añadir `Project 1──N ProjectInvitation` al diagrama de relaciones.
- Sección 5 (endpoints): las seis rutas nuevas y el `returnUrl` de `/auth/login`.
- Sección 7 (ejecución): `MAIL_USER` y `MAIL_PASSWORD`, con la nota de que Gmail exige contraseña de aplicación y 2FA.
- Sección 9: mover las invitaciones de "por hacer" a "listo".

- [ ] **Step 2: Actualizar `frontend/README.md`**

- Sección 2 (árbol): la feature `collaboration` completa.
- Sección 4 (rutas): `invitations/:token`.
- Sección 5 (autenticación): el `returnUrl` y para qué sirve.
- Sección 9: mover la feature `collaboration` de "por hacer" a "listo", dejando los comentarios y el tiempo real como pendientes.

- [ ] **Step 3: Actualizar `TODO.md`**

Mover a "FUNCIONALIDADES LISTAS" los cinco puntos de invitaciones. Dejar en pendientes solo la edición en tiempo real.

- [ ] **Step 4: Commitear**

```bash
git add backend/README.md frontend/README.md TODO.md
git commit -m "docs: documentar el flujo de invitaciones a proyectos"
```

> Nota: `backend/README.md` y `frontend/README.md` tienen cambios sin commitear de antes de este plan (la reescritura de arquitectura). Confirmar con el dueño del repositorio si entran en este commit o en uno propio previo.
