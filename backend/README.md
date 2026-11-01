# BACKEND

API web en **.NET 8 (ASP.NET Core)** del proyecto de Seguridad (clon de Overleaf con Markdown → PDF).

> Este README es la referencia de arquitectura para humanos **y para agentes de IA**.
> Antes de escribir código, lee "Convenciones obligatorias" y "Cómo agregar una funcionalidad".

---

## 1. Stack

| Pieza | Elección |
|---|---|
| Runtime | .NET 8 (`net8.0`), `Nullable` y `ImplicitUsings` habilitados |
| Web | ASP.NET Core MVC controllers + Swagger (solo en Development) |
| ORM | EF Core 8 + `Npgsql` (PostgreSQL) |
| Auth | Cookie de sesión (`overleaf_session`) + Google OAuth2 |
| Markdown → HTML | `Markdig` |
| HTML → PDF | `PuppeteerSharp` (Chromium headless) |
| Correo | `MailKit` (SMTP real de Gmail, `smtp.gmail.com:587`, StartTls) |
| Config | Variables de entorno vía `DotNetEnv` (`.env`) + `appsettings.json` |

Namespace raíz: `Backend`. El namespace **siempre** refleja la ruta de carpetas
(`Backend/App/Projects/ProjectService.cs` → `namespace Backend.App.Projects;`).

---

## 2. Arquitectura por capas

Arquitectura en capas con dependencia hacia adentro. **Nunca** invertir estas flechas:

```
Presentation ──► App ──► Domain
     │            │        ▲
     │            └──► Data (EF Core / AppDatabase)
     │                     │
     └── Config (DI)       └── Infrastructure ──► implementa interfaces de Domain
```

| Capa | Carpeta | Responsabilidad | Reglas |
|---|---|---|---|
| **Presentation** | `Presentation/` | Tráfico HTTP: rutas, status codes, JSON | Controllers delgados. Sin lógica de negocio, sin EF Core, sin `AppDatabase` |
| **App** | `App/` | Lógica de aplicación y **autorización** | Es la única capa que consulta `AppDatabase`. No conoce `HttpContext` (excepto `LogoutService`) |
| **Domain** | `Domain/` | Entidades, enums y **contratos** (interfaces) | Cero dependencias de framework, EF o librerías externas |
| **Data** | `Data/` | `DbContext`, mapeos y migraciones | Toda la configuración de tablas vive en `AppDatabase.OnModelCreating` |
| **Infrastructure** | `Infrastructure/` | Implementaciones técnicas de contratos de Domain | Aquí van Puppeteer, SMTP, filesystem, HTTP clients… |
| **Config** | `Config/` | Registro en el contenedor de DI | Un `static class XConfig` con un método de extensión `AddX()` por área |

### Árbol real

```text
backend/
├── Program.cs                      # Entrypoint: carga .env, compone AddX(), pipeline, Migrate(), MapControllers()
├── backend.csproj
├── appsettings.json                # Logging, AllowedHosts
├── appsettings.Development.json
├── .env                            # CONNECTION_STRING, GOOGLE_OAUTH_*, CHROMIUM_PATH (NO versionado)
│
├── Config/                         # Composición de dependencias
│   ├── DatabaseConfig.cs           # AddDatabase(connectionString) -> AddDbContext<AppDatabase>(UseNpgsql)
│   ├── AuthConfig.cs               # AddAuth(...): cookie + Google, CORS, FrontendOptions
│   ├── ServicesConfig.cs           # AddServices(): registra TODOS los servicios de App/ como Scoped
│   ├── CompilationConfig.cs        # AddCompilation(): IDocumentConverter -> MarkdownToPdfConverter (Singleton)
│   └── MailConfig.cs               # AddMailer(...): INotifier -> EmailNotifier (Scoped)
│
├── Domain/
│   ├── Models/                     # Project, ProjectFile, ProjectMember, User, ProjectInvitation
│   ├── Enums/                      # Roles {Owner,Editor,Viewer}, ProjectFileType {File,Folder},
│   │                               # InvitationStatus {Pending,Accepted,Revoked}
│   └── Services/                   # Contratos: IDocumentConverter, INotifier
│
├── Data/
│   ├── Database/AppDatabase.cs     # DbSets + OnModelCreating (tablas snake_case, índices, FKs, conversiones)
│   └── Migrations/                 # Generadas con dotnet-ef. NO editar a mano
│
├── App/
│   ├── Auth/
│   │   ├── AuthClaimTypes.cs       # const UserId = "user_id"  (claim propio, no el de Google)
│   │   ├── LoginService.cs         # Upsert del User a partir del ClaimsPrincipal de Google
│   │   ├── LogoutService.cs
│   │   └── MeService.cs
│   ├── Projects/
│   │   ├── ProjectService.cs       # CRUD, archivar, copiar (con transacción)
│   │   ├── ProjectFileService.cs   # CRUD del árbol de archivos + validaciones de nombre
│   │   ├── ProjectCompilationService.cs  # Autoriza y delega en IDocumentConverter
│   │   └── ProjectInvitationService.cs   # Crear/listar/revocar/reenviar/aceptar invitaciones
│   └── Dtos/                       # DTOs internos de App (hoy casi vacío)
│
├── Infrastructure/
│   ├── Compilation/MarkdownToPdfConverter.cs   # Markdig + PuppeteerSharp
│   └── Mail/EmailNotifier.cs       # INotifier vía MailKit (SMTP)
│
└── Presentation/
    ├── Controllers/                # AuthController, ProjectsController, ProjectFilesController,
    │                               # ProjectCompilationController, ProjectInvitationsController,
    │                               # InvitationsController
    └── Dtos/
        ├── Requests/               # CreateProjectRequest, UpdateProjectFileContentRequest,
        │                           # CreateInvitationRequest, …
        └── Responses/              # ProjectResponse, ProjectFileResponse, MeResponse,
                                     # InvitationResponse, InvitationPreviewResponse,
                                     # AcceptInvitationResponse, …
```

---

## 3. Convenciones obligatorias

Son las que ya sigue el código. Un cambio que las rompa está mal, aunque compile.

### Inyección de dependencias
Usar **primary constructors** y reasignar a campos `private readonly _camelCase`:

```csharp
public class ProjectService(AppDatabase database)
{
    private readonly AppDatabase _database = database;
}
```

Todo servicio de `App/` se registra como `Scoped` en `ServicesConfig.AddServices()`.
Las implementaciones de infraestructura sin estado por petición van `Singleton`
(ver `CompilationConfig`).

### Controllers
Patrón fijo, sin excepciones:

```csharp
[ApiController]
[Authorize]
[Route("projects/{projectId:guid}/files")]
public class ProjectFilesController(ProjectFileService projectFileService) : ControllerBase
{
    private readonly ProjectFileService _projectFileService = projectFileService;

    [HttpGet]
    public async Task<ActionResult<List<ProjectFileTreeResponse>>> GetFiles(Guid projectId)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await _projectFileService.GetFilesAsync(projectId, userId);
        return result.Status == ProjectFileResultStatus.Success ? Ok(result.Value) : Forbid();
    }

    private bool TryGetCurrentUserId(out Guid userId) => Guid.TryParse(
        User.FindFirstValue(AuthClaimTypes.UserId), out userId);
}
```

- El `userId` **siempre** sale del claim `AuthClaimTypes.UserId`, nunca de la ruta,
  del query string ni del body. Si no se puede parsear → `Unauthorized()`.
- Rutas en minúsculas, sin prefijo `api/` (lo añade el proxy del frontend).
  Constraints de tipo en la plantilla: `{id:guid}`.
- El controller solo traduce: `Ok`, `CreatedAtAction`, `NoContent`, `BadRequest`,
  `Conflict`, `Forbid`, `UnprocessableEntity`.

### Resultados de servicios → status codes
Los servicios **no lanzan excepciones para el flujo esperado**. Devuelven un
enum de estado + valor, y el controller lo mapea:

```csharp
public enum ProjectFileResultStatus { Success, Forbidden, Invalid, Conflict }
public record ProjectFileResult<T>(ProjectFileResultStatus Status, T? Value = default);
```

Mapeo canónico: `Invalid → 400`, `Conflict → 409`, `Forbidden → 403`,
`MainFileNotFound → 422`, éxito sin cuerpo → `204`.
`ProjectService` es la excepción histórica: usa `null` para "sin acceso" y lanza
`ArgumentException` para nombre vacío, que el controller captura y convierte en `400`.
**Para código nuevo, usa el patrón enum + record.**

Errores con cuerpo: siempre `new { error = "mensaje en español" }`.

### DTOs
- `Presentation/Dtos/Requests`: clases con `[Required]` donde aplique e
  inicializadores (`= string.Empty`).
- `Presentation/Dtos/Responses`: clases planas; se heredan cuando una es
  superconjunto de otra (`ProjectFileResponse : ProjectFileTreeResponse`).
- La serialización es **camelCase** (configurada en `Program.cs`).
- Los enums **no se serializan como enums**: se proyectan a strings en mayúsculas
  dentro del servicio (`"OWNER"`/`"EDITOR"`/`"VIEWER"`, `"FILE"`/`"FOLDER"`).
  El frontend depende de esos literales exactos.

### Consultas EF Core
- Lecturas: `.AsNoTracking()` + `.Select(...)` **proyectando directo al DTO de
  respuesta**. No materializar entidades para luego mapearlas.
- Escrituras de varias entidades relacionadas: transacción explícita
  (`await using var transaction = await _database.Database.BeginTransactionAsync();`
  … `await transaction.CommitAsync();`), como en `CreateOwnedProjectAsync` y
  `CopyProjectAsync`.
- Al mutar una entidad, actualizar `UpdatedAt = DateTimeOffset.UtcNow` a mano.
- Fechas: `DateTimeOffset` en UTC, siempre.
- Ids: `Guid` generados por la base.

### Modelo de datos
Entidades con primary constructor, propiedades `{ get; set; }` y colecciones
inicializadas en `[]`:

```csharp
public class Project(string name, Guid ownerId)
{
    public Guid Id { get; set; }
    public string Name { get; set; } = name;
    public Guid OwnerId { get; set; } = ownerId;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<ProjectMember> Members { get; set; } = [];
}
```

Tablas y columnas se configuran en `AppDatabase.OnModelCreating` con
`entity.ToTable("snake_case")`; los enums se persisten como string
(`.HasConversion<string>()`).

Relaciones vigentes:

```
User 1──N Project         (OwnerId, DeleteBehavior.Restrict)
User N──N Project         vía ProjectMember (PK compuesta ProjectId+UserId, Role)
Project 1──N ProjectFile  (Cascade)
ProjectFile 1──N ProjectFile (ParentId autorreferencial, Cascade) → árbol
Project 1──N ProjectInvitation (Cascade; TokenHash único; InvitedBy → User, Restrict)
```

---

## 4. Autenticación y autorización

**Flujo de login** (sin contraseñas locales; solo Google):

1. `GET /auth/login` → `Challenge(Google)` con `RedirectUri` al frontend (`/projects`).
2. Google vuelve a `/signin-google`. En `OnCreatingTicket` (`AuthConfig`) se llama
   a `LoginService.LoginWithGoogleAsync`, que hace upsert del `User` y añade el
   claim `user_id` con el `Guid` interno.
3. Se emite la cookie `overleaf_session` (HttpOnly, SameSite=Lax, 7 días, sliding).
4. El frontend valida sesión con `GET /auth/me`.

`OnRedirectToLogin`/`OnRedirectToAccessDenied` están sobreescritos para devolver
**401/403 en lugar de redirecciones** — es una API, no una app con vistas.

**Autorización**: `[Authorize]` solo garantiza "hay sesión". El permiso sobre un
proyecto se decide **siempre en la capa App**, consultando `ProjectMembers`:

```csharp
private Task<ProjectAccess?> GetAccessAsync(Guid projectId, Guid userId) => _database.ProjectMembers
    .AsNoTracking()
    .Where(member => member.ProjectId == projectId && member.UserId == userId)
    .Select(member => new ProjectAccess(member.Role, member.Project.IsArchived))
    .SingleOrDefaultAsync();

private static bool CanWrite(ProjectAccess? access) => access is not null
    && !access.IsArchived
    && access.Role is Roles.Owner or Roles.Editor;
```

Reglas del modelo de permisos:

- **No ser miembro ≡ no existir.** Un recurso ajeno devuelve `403`, nunca `404`.
  No filtrar la existencia de proyectos o archivos de otros usuarios.
- Leer requiere membresía (cualquier rol). Escribir requiere `Owner` o `Editor`
  **y** que el proyecto no esté archivado.
- Operaciones de dueño (renombrar, archivar el proyecto) usan
  `GetOwnedProjectAsync`, que exige `OwnerId == userId` **y** membresía con rol `Owner`.
- Cualquier endpoint nuevo que toque un proyecto **debe** empezar por esta
  verificación. Es el requisito central del proyecto (ver `TODO.md`).

**CORS**: política única `Frontend`, con `WithOrigins(frontendUrl)` +
`AllowCredentials()`. El origen sale de `Frontend:BaseUrl` (`appsettings`) con
fallback `http://localhost:4200`. Credenciales por cookie ⇒ **no se puede usar
`AllowAnyOrigin()`**.

---

## 5. Endpoints actuales

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/auth/login?returnUrl=` | — | Redirige a Google; `returnUrl` debe ser una ruta relativa del frontend o cae a `/projects` |
| GET | `/auth/me` | sesión | `MeResponse` o 401 |
| POST | `/auth/logout` | — | 204 |
| GET | `/projects?archived=false` | sesión | Stream `IAsyncEnumerable<ProjectResponse>` |
| GET | `/projects/{id:guid}` | miembro | 403 si no es miembro |
| POST | `/projects` | sesión | Crea proyecto + membresía `Owner` + `main.md` |
| PUT | `/projects/{id:guid}` | owner | Renombrar |
| DELETE | `/projects/{id:guid}` | owner | **Archiva** (soft delete), no borra |
| POST | `/projects/{id:guid}/copy` | miembro | Duplica proyecto y árbol completo |
| GET | `/projects/{projectId}/files` | miembro | Árbol plano (`ProjectFileTreeResponse[]`) |
| GET | `/projects/{projectId}/files/{fileId}` | miembro | Incluye `content` |
| POST | `/projects/{projectId}/files` | editor | 400 inválido / 409 duplicado |
| PUT | `/projects/{projectId}/files/{fileId}` | editor | Renombrar |
| PUT | `/projects/{projectId}/files/{fileId}/content` | editor | Guardar contenido |
| DELETE | `/projects/{projectId}/files/{fileId}` | editor | Cascade a hijos |
| POST | `/projects/{projectId}/compile` | miembro | `application/pdf` o 422 |
| GET | `/projects/{projectId}/invitations` | owner | Lista invitaciones, estado derivado (`EXPIRED`) |
| POST | `/projects/{projectId}/invitations` | owner | Crea y envía la invitación por correo |
| POST | `/projects/{projectId}/invitations/{id}/resend` | owner | Nuevo token, invalida el anterior |
| DELETE | `/projects/{projectId}/invitations/{id}` | owner | Revoca (solo si `PENDING`) |
| GET | `/invitations/{token}` | sesión | Preview; 404/410/403 según estado |
| POST | `/invitations/{token}/accept` | sesión | Crea el `ProjectMember`; idempotente |

Detalles que el frontend asume:

- Crear un proyecto siembra un `main.md` en la raíz. La compilación **solo** lee
  ese archivo (`ParentId == null && Name == "main.md"`); si falta → `422`.
- El árbol se devuelve **plano**; el anidamiento se reconstruye en el cliente con
  `parentId`.
- Validación de nombres (`IsValidName`): no vacío, distinto de `.` y `..`, sin
  `/`, sin `\`, sin caracteres de control. Un `parentId` debe existir, pertenecer
  al mismo proyecto y ser `Folder`. Unicidad por `(ProjectId, ParentId, Name)`.

---

## 6. Compilación Markdown → PDF

`IDocumentConverter` (Domain) ← `MarkdownToPdfConverter` (Infrastructure):

1. `Markdig` con `UseAdvancedExtensions()`, `UseMathematics()` y **`DisableHtml()`**
   — el HTML embebido se neutraliza a propósito (el contenido es de usuario).
2. `PuppeteerSharp` lanza Chromium headless y renderiza a PDF.
3. El navegador se lanza **una vez** (`Task<IBrowser>` en el constructor, servicio
   `Singleton`): no abrir un browser por petición.
4. `CHROMIUM_PATH` apunta al Chromium del sistema (lo define `devenv.nix`). Si no
   está, `BrowserFetcher` descarga uno.

El controller captura `OperationCanceledException` (cliente que aborta) y
cualquier otra excepción la loguea y la convierte en `422`.

---

## 7. Ejecución

Variables de entorno en `backend/.env` (cargadas por `DotNetEnv.Env.Load()`):

```
CONNECTION_STRING=Host=localhost;Database=overleaf;Username=...;Password=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
MAIL_USER=tucuenta@gmail.com
MAIL_PASSWORD=...                  # contraseña de aplicación de 16 caracteres (requiere 2FA)
CHROMIUM_PATH=/ruta/a/chromium     # opcional
```

`Program.cs` falla al arrancar si falta `CONNECTION_STRING`,
`GOOGLE_OAUTH_CLIENT_ID`/`SECRET` (desde `AddAuth`), o `MAIL_USER`/`MAIL_PASSWORD`
(desde `AddMailer`). Esto es intencional: no hay modo degradado. `MAIL_PASSWORD`
**no** es la contraseña normal de la cuenta de Gmail: hace falta una
[contraseña de aplicación](https://myaccount.google.com/apppasswords), que exige
tener 2FA activo.

```bash
dotnet run                                   # arranca y aplica migraciones solo
dotnet build
dotnet ef migrations add NombreDeLaMigracion # requiere dotnet-ef (está en devenv)
```

`Program.cs` ejecuta `database.Database.Migrate()` al arrancar, así que **no hace
falta `dotnet ef database update`** en desarrollo. Pero sí hay que crear la
migración al cambiar el modelo.

Swagger: solo en Development, en `/swagger`. Puerto por defecto: `5282`
(ver `Properties/launchSettings.json`; es el target del proxy del frontend).

---

## 8. Cómo agregar una funcionalidad

Orden recomendado, de adentro hacia afuera:

1. **Domain** — entidad en `Domain/Models/` y/o enum en `Domain/Enums/`. Si
   necesitas una capacidad técnica externa (correo, ZIP, storage), define primero
   la interfaz en `Domain/Services/`.
2. **Data** — registra el `DbSet` y el mapeo en `AppDatabase.OnModelCreating`,
   luego `dotnet ef migrations add ...`.
3. **App** — servicio en `App/<Área>/` con: `AppDatabase` por constructor,
   verificación de acceso vía `ProjectMembers` **primero**, enum de estado +
   `record` de resultado, y proyección directa a DTOs de respuesta.
4. **Infrastructure** — implementa las interfaces de Domain que hayas definido.
5. **Config** — registra el servicio en `ServicesConfig.AddServices()` (o un
   `XConfig.AddX()` nuevo encadenado en `Program.cs` si es un área con su propia
   configuración).
6. **Presentation** — DTOs de request/response y controller delgado que solo mapea
   estados a status codes.

Checklist antes de dar algo por terminado:

- [ ] `userId` leído del claim, no del cliente.
- [ ] Autorización verificada en App contra `ProjectMembers`; recurso ajeno → `403`.
- [ ] Lecturas con `AsNoTracking()` + `Select` al DTO.
- [ ] Escritura multi-entidad en transacción; `UpdatedAt` actualizado.
- [ ] Enums expuestos como strings en mayúsculas.
- [ ] Servicio registrado en `ServicesConfig`.
- [ ] Migración creada si cambió el modelo.
- [ ] `dotnet build` sin warnings nuevos de nulabilidad.

---

## 9. Pendientes (ver `TODO.md` en la raíz)

Listo: editor Markdown → PDF, compilación automática al guardar, CRUD de
proyectos, árbol de archivos, guardado persistente, atajos de teclado,
invitaciones a proyectos por correo electrónico (crear, listar, revocar,
reenviar, aceptar; `ProjectMember` se crea al aceptar).

Por hacer, en orden de dependencia:

- Edición **en tiempo real** → necesitará un canal push (SignalR/WebSocket) y una
  estrategia de merge; hoy el guardado es `PUT` de contenido completo.
- Del README raíz, aún sin empezar: control de cambios (autoría/fecha),
  exportar/importar ZIP, y el flujo de encriptación extremo a extremo.
