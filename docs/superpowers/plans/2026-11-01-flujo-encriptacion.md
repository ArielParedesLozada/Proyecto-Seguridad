# Flujo de encriptación en tres capas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los datos de usuario viajan cifrados entre navegador y API, y se almacenan cifrados por la propia base de datos, con el algoritmo detrás de una abstracción sustituible.

**Architecture:** Dos claves independientes. `K_session` (32 bytes, generada en cada login, transportada como claim de la cookie que ASP.NET Core ya cifra, residente en memoria del navegador) protege el tramo navegador↔API mediante un middleware que descifra la petición antes del controller y cifra la respuesta al salir; los servicios no se enteran. `K_master` (en `backend/.env`) protege el almacenamiento: funciones `pgcrypto` declaradas `SECURITY DEFINER` cifran y descifran dos columnas, de modo que el rol de la aplicación pueda usarlas sin tener `SELECT` sobre ellas. Un sobre con identificador de algoritmo en ambas capas permite cambiar el cifrador sin perder los datos ya guardados.

**Tech Stack:** .NET 8 (`System.Security.Cryptography.AesGcm`, sin paquetes nuevos), EF Core 8 + Npgsql, PostgreSQL + extensión `pgcrypto`, Angular 22 + Web Crypto (`crypto.subtle`, sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-11-01-flujo-encriptacion-design.md` — leerlo completo antes de empezar. El plan argumenta desde el spec; los dos viajan juntos.

**Lectura previa obligatoria:** `backend/README.md` y `frontend/README.md`.

## Sobre la verificación, y una recomendación

**Este repositorio no tiene pruebas automatizadas** y el spec (§6) fija verificación manual, así que los pasos de verificación son comandos concretos con resultado comprobable. Ningún paso se marca como hecho sin haber ejecutado su comando y visto su salida.

**Pero la criptografía es el caso donde esto se nota más.** Los fallos de cifrado no se manifiestan como un error legible: se manifiestan como `authentication failed`, o peor, como datos que parecen correctos hasta que no lo son. Tres pruebas unitarias —ida y vuelta, posición del tag, algoritmo desconocido— se pagarían solas en la Tarea 1.

No las incluyo porque el spec aprobado no las contempla y añadir un proyecto de test es alcance que no me corresponde decidir. **Si quieres que entren, dilo y las añado como Tarea 0** (un `backend.Tests` con xUnit, unas 60 líneas). Mientras tanto, la verificación de las Tareas 1 y 5 usa endpoints temporales que se borran al final de su tarea, como se hizo con el envío de correo.

---

## Global Constraints

Valores copiados literalmente del spec. Aplican a **todas** las tareas.

- **Dos claves, nunca intercambiadas.** `K_session`: 32 bytes de `RandomNumberGenerator.GetBytes(32)`, generada en cada login, vive en el claim `session_key` de la cookie y en memoria del navegador. `K_master`: 32 bytes, de `CRYPTO_MASTER_KEY` en `backend/.env`, nunca sale del backend ni llega a un navegador.
- **Sobre en el cable:** `{ "alg": "AES-256-GCM", "v": 1, "iv": "<base64>", "ct": "<base64>" }`.
- **Cuidado con los nombres del JSON.** `Program.cs` tiene `JsonNamingPolicy.CamelCase`, así que un `record CipherEnvelope(string Algorithm, int Version, ...)` se serializaría como `{"algorithm":…,"version":…}` y **el frontend no lo reconocería**. Por eso el sobre tiene dos representaciones: `CipherEnvelope` en `Domain/` conserva nombres descriptivos y cero atributos de serialización, y `Presentation/Dtos/CipherEnvelopeDto.cs` lleva los nombres cortos del cable (`alg`, `v`, `iv`, `ct`) con `[JsonPropertyName]`. El middleware traduce entre los dos. Confundirlos da un `400` en la primera petición cifrada.
- **El tag GCM va concatenado al FINAL del ciphertext**, dentro de `ct`, que es como lo produce y lo espera Web Crypto. .NET parte los últimos 16 bytes al descifrar y los concatena al cifrar. **Es la fuente de error más probable de todo el trabajo.**
- **AES-GCM:** IV de **12 bytes** aleatorio por operación, tag de **16 bytes**.
- **Sobre en la base:** un byte de prefijo con el identificador de algoritmo, `0x01` = pgcrypto/AES. `decrypt_text` hace `CASE` sobre ese byte y **lanza excepción** ante un identificador desconocido; nunca devuelve basura.
- **Columnas cifradas, exactamente dos:** `project_files.content` → `content_cipher bytea`, `projects.name` → `name_cipher bytea`.
- **Columnas que NO se cifran, y es deliberado:** `project_files.name`, `project_invitations.email`, `users.email` — son claves de búsqueda, y `pgp_sym_encrypt` es no determinista. Cifrarlas exigiría un hash determinista al lado, que filtra la igualdad.
- **Las funciones son `SECURITY DEFINER`**, con `REVOKE ALL ... FROM PUBLIC` y `GRANT EXECUTE` solo al rol de la aplicación. Las columnas cifradas quedan fuera del `GRANT SELECT` a nivel de columna.
- **`K_master` viaja a las funciones como parámetro enlazado** (`FromSqlInterpolated` / `ExecuteSqlInterpolated`), **nunca interpolada en el texto del SQL**.
- **Rutas exentas de cifrado:** `/auth/*`, `/crypto/session`, `/swagger*`. Ninguna más — el PDF también va cifrado, devuelto como JSON.
- **El middleware se registra después de `UseAuthentication()` y antes de `MapControllers()`.**
- **Sin claim de sesión, el middleware deja pasar el cuerpo intacto** para que `[Authorize]` devuelva `401` y no un `400` confuso.
- **Los cuerpos de error van cifrados**, excepto el `400` que genera el propio middleware, que va **en claro**.
- **Cuerpo del `400` del middleware:** `{ error = "La carga cifrada no es válida." }`, **sin ningún detalle criptográfico**. No distinguir "sobre mal formado" de "tag no valida".
- **Se parte de base limpia.** Una sola migración; no hay backfill ni servicio de migración de datos.
- **Entidades de `Domain/Models/` sin cambios:** `ProjectFile.Content` y `Project.Name` siguen siendo `string` en C#. La traducción vive en la capa de datos.
- **Textos de error en español**, con el tono de los existentes.
- **Backend:** primary constructors, campos `private readonly _camelCase`, servicios de `App/` como `Scoped`, cifradores sin estado como `Singleton`. La app **no arranca** si falta configuración obligatoria.
- **Frontend:** sin `HttpClient` ni RxJS. Miembros reactivos `readonly`. `crypto.subtle` siempre detrás de `isPlatformBrowser`. CSS por componente por debajo de 4 kB.

---

## Review Focus

Clases de entrada que el spec implica y que conviene verificar explícitamente, de más a menos probable que muerdan.

1. **Posición del tag GCM entre C# y TypeScript.** Si los dos lados no coinciden, todo falla con `authentication failed` y el mensaje no dice por qué. Hay que probar las dos direcciones, no una. → Tarea 5.
2. **Contenido `null` frente a cadena vacía.** `ProjectFile.Content` es `""` en un archivo nuevo y `null` en una carpeta. Cifrar `null` y cifrar `""` tienen que distinguirse al volver, y ninguno puede reventar. → Tarea 3.
3. **Unicode en el documento.** Acentos, emoji y matemáticas atraviesan UTF-8 en C#, en `TextEncoder` del navegador y en `pgp_sym_encrypt`. Un fallo aquí corrompe el documento de forma silenciosa. → Tareas 3 y 5.
4. **Clave de sesión obsoleta en memoria.** Si el usuario vuelve a entrar en otra pestaña, el claim rota y la clave que guarda esta pestaña deja de servir: todas las peticiones responden `400` y la interfaz se queda muerta sin explicación. → Tarea 7.
5. **Petición sin autenticar a una ruta de datos.** Debe dar `401`, no `400` por sobre inválido. → Tarea 7.

---

## Estructura de archivos

**Backend — crear:**

| Archivo | Responsabilidad |
|---|---|
| `Domain/Services/ICipher.cs` | `CipherEnvelope` + contrato del cifrador |
| `Domain/Services/ICipherRegistry.cs` | Resolver el cifrador por algoritmo/versión |
| `Infrastructure/Crypto/AesGcmCipher.cs` | AES-256-GCM con `AesGcm` |
| `Infrastructure/Crypto/CipherRegistry.cs` | Implementación del registro |
| `Config/CryptoConfig.cs` | `AddCrypto(masterKeyBase64)` |
| `Data/Sql/00-bootstrap.sql` | Extensión + rol restringido (lo ejecuta un humano) |
| `Data/Database/EncryptedColumnStore.cs` | Único punto de acceso a las columnas cifradas |
| `Presentation/Middleware/CryptoEnvelopeMiddleware.cs` | Descifra la petición, cifra la respuesta |
| `Presentation/Controllers/CryptoController.cs` | `GET /crypto/session` |
| `Presentation/Dtos/Responses/SessionKeyResponse.cs` | |
| `Presentation/Dtos/Responses/CompileResponse.cs` | PDF en base64 |

**Backend — modificar:** `App/Auth/AuthClaimTypes.cs`, `Config/AuthConfig.cs`, `Config/ServicesConfig.cs`, `Program.cs`, `Data/Database/AppDatabase.cs`, `App/Projects/{ProjectFileService,ProjectService,ProjectCompilationService,ProjectInvitationService}.cs`, `Presentation/Controllers/{ProjectsController,ProjectCompilationController}.cs`, `.env`, `appsettings.json`.

**Frontend — crear:**

| Archivo | Responsabilidad |
|---|---|
| `core/crypto/cipher.interface.ts` | `CipherEnvelope` + `Cipher`, espejo del backend |
| `core/crypto/aes-gcm.cipher.ts` | Implementación con `crypto.subtle` |
| `core/crypto/cipher-registry.ts` | `current` y `resolve(alg, v)` |
| `core/crypto/session-key.service.ts` | Pide y guarda `K_session` en una signal |
| `core/crypto/crypto-transport.ts` | Envuelve y desenvuelve cuerpos |
| `core/http/api-client.ts` | El `request<T>()` compartido, con el cifrado dentro |

**Frontend — modificar:** `core/constants/api.constants.ts`, `features/projects/data-access/project.service.ts`, `features/editor/data-access/{project-file,project-compilation}.service.ts`, `features/collaboration/data-access/invitation.service.ts`.

---

## Task 1: El cifrador del backend y su registro

Deliverable: una cadena cifrada y descifrada con éxito en el backend, y la app no arranca sin `CRYPTO_MASTER_KEY`.

**Files:**
- Create: `backend/Domain/Services/ICipher.cs`, `backend/Domain/Services/ICipherRegistry.cs`
- Create: `backend/Infrastructure/Crypto/AesGcmCipher.cs`, `backend/Infrastructure/Crypto/CipherRegistry.cs`
- Create: `backend/Config/CryptoConfig.cs`
- Modify: `backend/Program.cs`, `backend/.env`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `record CipherEnvelope(string Algorithm, int Version, string Iv, string CipherText)`
  - `interface ICipher { string Algorithm { get; } int Version { get; } CipherEnvelope Encrypt(string plaintext, byte[] key); string Decrypt(CipherEnvelope envelope, byte[] key); }`
  - `interface ICipherRegistry { ICipher Current { get; } ICipher Resolve(string algorithm, int version); }`
  - `CryptoConfig.AddCrypto(this IServiceCollection, string masterKeyBase64) : IServiceCollection`, que además expone la clave maestra a la DI como `CryptoMasterKey` (un `record CryptoMasterKey(byte[] Value)` registrado Singleton).

- [ ] **Step 1: Crear `ICipher.cs` e `ICipherRegistry.cs` en `Domain/Services/`**

Definiciones exactas en el bloque Interfaces de arriba y en el spec §5.6. Cero `using` de framework — es `Domain/`.

- [ ] **Step 2: Implementar `AesGcmCipher`**

`Algorithm` devuelve `"AES-256-GCM"`, `Version` devuelve `1`.

`Encrypt`: IV de 12 bytes de `RandomNumberGenerator.GetBytes(12)`; cifra con `AesGcm`; **concatena el tag de 16 bytes al final del ciphertext** y codifica el resultado en base64 en `CipherText`.

`Decrypt`: decodifica, **parte los últimos 16 bytes como tag** y el resto como ciphertext; lanza `CryptographicException` si no valida (lo traduce el middleware en la Tarea 7).

Rechazar con `ArgumentException` una clave que no mida 32 bytes.

- [ ] **Step 3: Implementar `CipherRegistry`**

Recibe `IEnumerable<ICipher>` por constructor. `Current` devuelve el de `Algorithm == "AES-256-GCM"`. `Resolve` busca por `(Algorithm, Version)` y lanza `NotSupportedException` si no hay ninguno — ese es el mecanismo que hace sobrevivir al cambio de algoritmo.

- [ ] **Step 4: Crear `CryptoConfig.AddCrypto`**

Decodifica el base64, **valida que sean 32 bytes** y lanza `InvalidOperationException` mencionando `CRYPTO_MASTER_KEY` si falta o mide otra cosa — mismo criterio que `AuthConfig` y `MailConfig`. Registra `ICipher` → `AesGcmCipher`, `ICipherRegistry` → `CipherRegistry` y `CryptoMasterKey` como **Singleton**.

- [ ] **Step 5: Generar la clave y encadenar `AddCrypto` en `Program.cs`**

```bash
openssl rand -base64 32
```

Añadir `CRYPTO_MASTER_KEY=<lo anterior>` a `backend/.env` (ya está en `.gitignore`), leerla junto a las demás variables y encadenar `.AddCrypto(CRYPTO_MASTER_KEY)` en la composición de servicios.

- [ ] **Step 6: Verificar que compila**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`, sin warnings nuevos.

- [ ] **Step 7: Verificar la ida y vuelta con un endpoint temporal**

Añadir temporalmente a `AuthController` (se borra en el Step 10):

```csharp
[HttpGet("crypto-test")]
[Authorize]
public IActionResult CryptoTest(
    [FromServices] ICipherRegistry registry, [FromServices] CryptoMasterKey masterKey)
{
    var cipher = registry.Current;
    var original = "Hola, ñandú 🔐 ∑x²";
    var envelope = cipher.Encrypt(original, masterKey.Value);
    return Ok(new { envelope, roundTrip = cipher.Decrypt(envelope, masterKey.Value) == original });
}
```

Con sesión abierta, desde la consola de DevTools:

```js
await fetch('/api/auth/crypto-test', { credentials: 'include' }).then(r => r.json())
```

Expected: `roundTrip: true`, y el sobre con `alg: "AES-256-GCM"`, `v: 1`, un `iv` de 16 caracteres base64 (12 bytes) y un `ct` no vacío. **La cadena incluye acentos, eñe, emoji y matemáticas a propósito** *(Review Focus #3)* — si el round-trip falla ahí, es un problema de UTF-8, no de AES.

- [ ] **Step 8: Verificar que el tag está donde debe**

Añadir temporalmente al mismo endpoint una comprobación: decodificar `ct` a bytes y confirmar que `ct.Length == plaintextBytes.Length + 16`.

Expected: cierto. AES-GCM no añade padding, así que el ciphertext mide lo mismo que el texto claro y los 16 bytes extra son exactamente el tag. **Si esto no cuadra, la Tarea 5 va a fallar y no se sabrá por qué** *(Review Focus #1)*.

- [ ] **Step 9: Verificar el fallo de configuración**

Comentar `CRYPTO_MASTER_KEY` en `.env` y `dotnet run`.
Expected: no arranca; `InvalidOperationException` mencionando `CRYPTO_MASTER_KEY`. Repetir con un base64 de 16 bytes: mismo rechazo. Restaurar después.

- [ ] **Step 10: Borrar el endpoint temporal y commitear**

```bash
git add backend/Domain backend/Infrastructure backend/Config backend/Program.cs
git commit -m "feat: agregar cifrador AES-GCM y registro de algoritmos"
```

Confirmar con `git show --stat HEAD` que `backend/.env` **no** entró.

---

## Task 2: La capa de base de datos

Deliverable: la base cifra y descifra por sí misma, y el rol de la aplicación no puede leer las columnas cifradas.

**Files:**
- Create: `backend/Data/Sql/00-bootstrap.sql`
- Create: `backend/Data/Migrations/<timestamp>_AddColumnEncryption.cs` (generada)
- Modify: `backend/Data/Database/AppDatabase.cs`, `backend/.env`

**Interfaces:**
- Consumes: nada del código de la Tarea 1 (esta capa es SQL).
- Produces: `app_crypto.encrypt_text(plaintext text, key text) → bytea` y `app_crypto.decrypt_text(payload bytea, key text) → text`. Columnas `project_files.content_cipher bytea` y `projects.name_cipher bytea`.

- [ ] **Step 1: Borrar la base de datos**

El spec decide partir limpio. Con la app parada:

```bash
psql -c 'DROP DATABASE overleaf;' -c 'CREATE DATABASE overleaf;'
```

- [ ] **Step 2: Escribir y ejecutar `00-bootstrap.sql`**

Contenido en el spec §5.4: `CREATE EXTENSION pgcrypto`, `CREATE ROLE overleaf_app LOGIN PASSWORD ...`, `GRANT CONNECT` y `GRANT USAGE ON SCHEMA public`. Se ejecuta **como superusuario, una sola vez**, porque `Migrate()` corre con el rol de la aplicación y no puede crear extensiones ni roles.

Añadir `APP_DB_USER` y `APP_DB_PASSWORD` a `.env` y apuntar `CONNECTION_STRING` al rol nuevo.

- [ ] **Step 3: Mapear las columnas cifradas en `AppDatabase`**

Las entidades no cambian, así que EF tiene que **dejar de mapear** las propiedades de texto y pasar a conocer solo las columnas `bytea`:

```csharp
entity.Ignore(file => file.Content);
entity.Property<byte[]?>("content_cipher");
```

y lo equivalente con `Project.Name` → `name_cipher`. **El `Ignore()` es el mecanismo clave y no es obvio:** sin él, EF busca una columna `content` que ya no existe y toda consulta falla. Con él, `ProjectFile.Content` sigue existiendo en C# pero EF no lo persiste ni lo carga — de eso se encarga el store de la Tarea 3.

`Project.Name` deja de poder ser `IsRequired()`; quitarlo.

- [ ] **Step 4: Crear la migración con las funciones, los permisos y las columnas**

Run: `cd backend && dotnet ef migrations add AddColumnEncryption`

Completar el `Up()` con `migrationBuilder.Sql(...)` para el esquema `app_crypto`, las dos funciones (`SECURITY DEFINER`), los `REVOKE`/`GRANT EXECUTE`, y el `GRANT SELECT` a nivel de columna que **excluye** `content_cipher` y `name_cipher`. SQL completo en el spec §5.4.

Revisar que el `Up()` generado elimina `content` y `name` y añade las columnas `bytea`.

- [ ] **Step 5: Aplicar y verificar el esquema**

Run: `dotnet run` (aplica migraciones al arrancar), luego parar.

Run: `psql -c '\d project_files' -c '\d projects' -c '\df app_crypto.*'`
Expected: `content_cipher` y `name_cipher` son `bytea`; las columnas `content` y `name` ya no están; las dos funciones existen y figuran como `definer`.

- [ ] **Step 6: Verificar que la base cifra y descifra**

```sql
SELECT app_crypto.decrypt_text(app_crypto.encrypt_text('ñandú 🔐', 'clave-de-prueba'), 'clave-de-prueba');
```
Expected: `ñandú 🔐` *(Review Focus #3 en la capa SQL)*.

```sql
SELECT substring(app_crypto.encrypt_text('x', 'k') from 1 for 1);
```
Expected: `\x01` — el byte de algoritmo está delante.

- [ ] **Step 7: Verificar el rechazo de un algoritmo desconocido**

```sql
SELECT app_crypto.decrypt_text('\x02deadbeef'::bytea, 'k');
```
Expected: excepción `Algoritmo de cifrado desconocido: 2`. **No** debe devolver `NULL` ni basura: eso es lo que hará sobrevivible el cambio de algoritmo.

- [ ] **Step 8: Verificar el aislamiento del rol — la prueba del objetivo central**

Conectado **como `overleaf_app`**:

```sql
SELECT content_cipher FROM project_files LIMIT 1;   -- debe FALLAR
SELECT id, name FROM project_files LIMIT 1;          -- debe funcionar
SELECT app_crypto.decrypt_text(app_crypto.encrypt_text('x','k'),'k');  -- debe funcionar
```

Expected, en ese orden: `ERROR: permission denied for column content_cipher`; la segunda devuelve filas; la tercera devuelve `x`. **Esta es la demostración de "NO USAR ADMIN PARA TODO"**: el rol no puede leer la columna pero sí puede operar a través de la función, gracias a `SECURITY DEFINER`.

- [ ] **Step 9: Commitear**

```bash
git add backend/Data
git commit -m "feat: cifrar columnas sensibles con funciones pgcrypto y rol restringido"
```

---

## Task 3: El store de columnas cifradas y la adaptación de los servicios

Deliverable: la aplicación funciona **completa** con el contenido y los nombres cifrados en la base — todavía sin cifrado en el cable.

**Files:**
- Create: `backend/Data/Database/EncryptedColumnStore.cs`
- Modify: `backend/App/Projects/ProjectFileService.cs`, `ProjectService.cs`, `ProjectCompilationService.cs`, `ProjectInvitationService.cs`
- Modify: `backend/Presentation/Controllers/ProjectsController.cs`, `backend/Config/CryptoConfig.cs`

**Interfaces:**
- Consumes: `CryptoMasterKey` (Tarea 1); las funciones `app_crypto.*` (Tarea 2).
- Produces: `EncryptedColumnStore` con las cinco firmas del spec §5.5 (`ReadProjectFileContentAsync`, `WriteProjectFileContentAsync`, `CopyProjectFileContentAsync`, `ReadProjectNamesAsync`, `WriteProjectNameAsync`).

- [ ] **Step 1: Implementar `EncryptedColumnStore`**

Primary constructor con `AppDatabase` y `CryptoMasterKey`. Las cinco firmas están en el spec §5.5.

**`K_master` va siempre como parámetro enlazado** (`FromSqlInterpolated` / `ExecuteSqlInterpolated`), nunca interpolada en el texto del SQL.

`ReadProjectNamesAsync` recibe una colección de ids y devuelve `Dictionary<Guid, string>` en **una sola consulta** — evita el N+1 de la lista de proyectos.

`CopyProjectFileContentAsync` hace `UPDATE ... SET content_cipher = (SELECT content_cipher FROM ...)`: copia ciphertext a ciphertext **sin descifrar**.

Registrarlo como `Scoped` en `CryptoConfig.AddCrypto`.

- [ ] **Step 2: Adaptar `ProjectFileService`**

`GetFileAsync` lee el contenido por el store (la proyección de EF ya no puede traerlo). `UpdateContentAsync` lo escribe por el store. `CreateFileAsync` escribe el contenido inicial —`""` para archivo, `null` para carpeta— por el store, después del `SaveChangesAsync` que asigna el `Id`.

`GetFilesAsync` **no cambia**: no proyecta el contenido.

- [ ] **Step 3: Adaptar `ProjectService`**

`GetProjectsAsync` pasa de `IAsyncEnumerable<ProjectResponse>` a `Task<List<ProjectResponse>>`: materializa las filas, pide los nombres en lote y los rellena. `ProjectsController.GetProjects` cambia de `Ok(IAsyncEnumerable)` a `Ok(await ...)`; **el JSON que ve el frontend es idéntico**.

`GetProjectAsync`, `CreateProjectAsync` y `UpdateProjectAsync` leen y escriben el nombre por el store. `CopyProjectAsync` usa `CopyProjectFileContentAsync` para cada archivo y el store para el nombre del proyecto nuevo (`"{origen} - Copia"`, que sí necesita descifrar el original).

- [ ] **Step 4: Adaptar `ProjectCompilationService`**

Lee el contenido de `main.md` por el store. **El filtro `Name == "main.md"` no cambia**, porque `project_files.name` no está cifrado.

- [ ] **Step 5: Adaptar `ProjectInvitationService`**

Es el que más fácil se olvida. Lee `project.Name` en **seis** sitios: asunto y cuerpo del correo al invitar, los dos mismos al reenviar, y `ProjectName` en el preview y en la respuesta de aceptación. Todos pasan por el store.

- [ ] **Step 6: Verificar que compila**

Run: `cd backend && dotnet build`
Expected: `Build succeeded`. Si queda algún `.Name` o `.Content` leído desde una proyección de EF, aquí no falla — falla en tiempo de ejecución, así que el Step 7 es obligatorio.

- [ ] **Step 7: Verificar la aplicación completa, sin cifrado en el cable**

Con `dotnet run` y el frontend arrancado, recorrer todo a mano: crear proyecto, ver que aparece con su nombre en la lista, abrirlo, editar `main.md` con **acentos, eñes y un emoji** *(Review Focus #3)*, `Ctrl+S`, recargar y comprobar que el texto vuelve intacto. Compilar y ver el PDF. Renombrar el proyecto. Duplicarlo y comprobar que la copia tiene el mismo contenido. Crear una carpeta y un archivo dentro.

Expected: todo funciona como antes del cambio.

- [ ] **Step 8: Verificar `null` frente a cadena vacía** *(Review Focus #2)*

Crear una **carpeta** (contenido `null`) y un **archivo nuevo** (contenido `""`), y pedir los dos con `GET /projects/{p}/files/{f}`.

Expected: la carpeta devuelve `content: null`, el archivo devuelve `content: ""`. No deben confundirse ni provocar un 500.

- [ ] **Step 9: Verificar que la base guarda ciphertext**

Run: `psql -c "select content_cipher from project_files limit 1" -c "select name_cipher from projects limit 1"` (como superusuario, el rol de la app no puede).
Expected: bytea que empieza por `\x01`. Buscar una frase del documento en la salida: cero resultados.

- [ ] **Step 10: Verificar que las invitaciones siguen bien**

Invitar a una segunda cuenta y comprobar que **el correo llega con el nombre del proyecto en el asunto y en el cuerpo** (no vacío), y que la pantalla de aceptación lo muestra. Aceptar y abrir el proyecto.

Expected: el nombre del proyecto aparece correcto en los tres sitios. Si sale vacío, falta el Step 5.

- [ ] **Step 11: Commitear**

```bash
git add backend/Data backend/App backend/Presentation backend/Config
git commit -m "feat: leer y escribir las columnas cifradas a traves del store"
```

---

## Task 4: La clave de sesión

Deliverable: tras iniciar sesión, `GET /crypto/session` entrega una clave distinta en cada login.

**Files:**
- Modify: `backend/App/Auth/AuthClaimTypes.cs`, `backend/Config/AuthConfig.cs`
- Create: `backend/Presentation/Controllers/CryptoController.cs`, `backend/Presentation/Dtos/Responses/SessionKeyResponse.cs`

**Interfaces:**
- Consumes: nada de las tareas anteriores.
- Produces: `AuthClaimTypes.SessionKey = "session_key"`; `GET /crypto/session` → `SessionKeyResponse { string Key; string Algorithm; int Version; }`.

- [ ] **Step 1: Añadir la constante del claim**

En `App/Auth/AuthClaimTypes.cs`: `public const string SessionKey = "session_key";`

- [ ] **Step 2: Generar y añadir la clave en el login**

En `Config/AuthConfig.cs`, dentro del `OnCreatingTicket` **que ya añade el claim `UserId`**, añadir 32 bytes aleatorios en base64 como claim `SessionKey`. Código en el spec §5.2.

- [ ] **Step 3: Crear `SessionKeyResponse` y `CryptoController`**

`[ApiController] [Authorize] [Route("crypto")]`, con `GET session`. Lee el claim; si falta, `Unauthorized()` — eso cubre las cookies emitidas antes de esta funcionalidad. `Algorithm` y `Version` salen de `ICipherRegistry.Current`, no de literales.

- [ ] **Step 4: Verificar compilación y entrega de la clave**

Run: `cd backend && dotnet build` → `Build succeeded`.

Cerrar sesión, volver a entrar, y desde la consola:

```js
await fetch('/api/crypto/session', { credentials: 'include' }).then(r => r.json())
```

Expected: `{ key: "<44 caracteres base64>", algorithm: "AES-256-GCM", version: 1 }`.

- [ ] **Step 5: Verificar que la clave rota en cada login**

Guardar la clave, cerrar sesión, volver a entrar, pedirla otra vez.
Expected: una clave **distinta**. Si sale la misma, la generación está fuera del `OnCreatingTicket`.

- [ ] **Step 6: Verificar el rechazo sin claim**

Borrar la cookie `overleaf_session` y pedir el endpoint.
Expected: `401`.

- [ ] **Step 7: Commitear**

```bash
git add backend/App/Auth backend/Config/AuthConfig.cs backend/Presentation
git commit -m "feat: entregar una clave de cifrado por sesion al frontend"
```

---

## Task 5: El cifrador del frontend y la interoperabilidad

Deliverable: el navegador cifra y descifra con la misma clave que el backend, comprobado **en las dos direcciones**. Es la tarea donde aparece el fallo del tag si existe.

**Files:**
- Create: `frontend/src/app/core/crypto/cipher.interface.ts`, `aes-gcm.cipher.ts`, `cipher-registry.ts`, `session-key.service.ts`, `crypto-transport.ts`
- Modify: `frontend/src/app/core/constants/api.constants.ts`

**Interfaces:**
- Consumes: `GET /crypto/session` (Tarea 4).
- Produces:
  - `interface CipherEnvelope { alg: string; v: number; iv: string; ct: string; }`
  - `interface Cipher { readonly algorithm: string; readonly version: number; encrypt(plaintext: string, key: CryptoKey): Promise<CipherEnvelope>; decrypt(envelope: CipherEnvelope, key: CryptoKey): Promise<string>; }`
  - `SessionKeyService` con `readonly key: Signal<CryptoKey | null>`, `load(): Promise<void>` y `clear(): void`
  - `CryptoTransport` con `wrap(body: unknown): Promise<string>` y `unwrap<T>(raw: string): Promise<T>`

- [ ] **Step 1: Añadir la ruta a `API_ROUTES`**

```ts
crypto: { session: '/crypto/session' },
```

- [ ] **Step 2: Crear los tipos y el cifrador AES-GCM**

`aes-gcm.cipher.ts` usa `crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)` con **IV de 12 bytes** de `crypto.getRandomValues`. Web Crypto **ya concatena el tag al final del ciphertext**, así que el resultado se codifica a base64 tal cual: no hay que mover nada. `decrypt` es la operación inversa.

Texto ↔ bytes con `TextEncoder` / `TextDecoder` (UTF-8) *(Review Focus #3)*.

- [ ] **Step 3: Crear `cipher-registry.ts`**

`current` devuelve el AES-GCM; `resolve(alg, v)` busca y **lanza** si no lo conoce. Espejo del backend: es lo que permitirá añadir el algoritmo propio.

- [ ] **Step 4: Crear `SessionKeyService`**

`@Injectable({ providedIn: 'root' })`. `load()` pide `GET /crypto/session` con `credentials: 'include'`, importa la clave con `crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt','decrypt'])` y la guarda en una signal privada expuesta como `readonly`.

**`extractable: false`** a propósito: así la clave no se puede volver a serializar desde JavaScript.

Todo detrás de `isPlatformBrowser`. **Nunca** en `localStorage` ni `sessionStorage`.

- [ ] **Step 5: Crear `crypto-transport.ts`**

`wrap` serializa el cuerpo a JSON, lo cifra con `registry.current` y la clave de sesión, y devuelve el sobre serializado. `unwrap` deserializa el sobre, resuelve el cifrador con `resolve(alg, v)`, descifra y parsea.

- [ ] **Step 6: Verificar compilación**

Run: `cd frontend && pnpm build`
Expected: compila sin errores.

- [ ] **Step 7: Verificar la ida y vuelta dentro del navegador**

Con sesión abierta, exponer temporalmente los servicios en `window` desde `app.ts` (o usar la consola con `ng.getComponent`) y ejecutar un cifrado y descifrado de `"Hola, ñandú 🔐 ∑x²"`.
Expected: la cadena vuelve idéntica.

- [ ] **Step 8: Verificar la interoperabilidad C# → navegador** *(Review Focus #1)*

Reactivar el endpoint temporal del Step 7 de la Tarea 1, pero cifrando **con la clave de sesión** en lugar de la maestra. Desde la consola, descifrar ese sobre con el cifrador del frontend.
Expected: `"Hola, ñandú 🔐 ∑x²"`. Si da `OperationError`, el tag está en el sitio equivocado en el backend.

- [ ] **Step 9: Verificar la interoperabilidad navegador → C#** *(Review Focus #1)*

Añadir temporalmente un endpoint que reciba un sobre, lo descifre con la clave de sesión y devuelva el texto. Mandarle desde la consola un sobre generado por el frontend.
Expected: devuelve la cadena original. **Las dos direcciones tienen que pasar**: un error de concatenación puede dar una dirección correcta y la otra no.

- [ ] **Step 10: Borrar los endpoints temporales y commitear**

```bash
git add frontend/src/app/core/crypto frontend/src/app/core/constants/api.constants.ts
git commit -m "feat: agregar cifrador AES-GCM y clave de sesion en el frontend"
```

---

## Task 6: El helper HTTP compartido

Deliverable: los tres servicios de datos usan un único `request<T>()`, **con el cifrado todavía desactivado**. Es un refactor sin cambio de comportamiento, revisable por separado.

**Files:**
- Create: `frontend/src/app/core/http/api-client.ts`
- Modify: `frontend/src/app/features/projects/data-access/project.service.ts`, `frontend/src/app/features/editor/data-access/project-file.service.ts`, `frontend/src/app/features/collaboration/data-access/invitation.service.ts`

**Interfaces:**
- Consumes: `CryptoTransport` y `SessionKeyService` (Tarea 5), inyectados pero sin usar todavía.
- Produces: `ApiClient` (`@Injectable({ providedIn: 'root' })`) con `request<T>(path: string, init?: RequestInit): Promise<T>` y el tipo `ApiError extends Error { status: number }`.

- [ ] **Step 1: Crear `ApiClient` con el comportamiento actual, sin cifrado**

Copiar literalmente la lógica del `request<T>()` que hoy está duplicado: `credentials: 'include'`, `Content-Type: application/json`, lectura de `{ error }` / `{ title }` en los fallos, `204` → `undefined`.

Añadir el `status` al error lanzado (`ApiError`), que la Tarea 7 necesita para distinguir el `400` del middleware.

- [ ] **Step 2: Migrar los tres servicios al `ApiClient`**

`project.service.ts`, `project-file.service.ts` e `invitation.service.ts` inyectan `ApiClient` con `inject()` y borran su copia privada de `request<T>()`. Las firmas públicas de los servicios **no cambian**.

`invitation.service.ts` necesita el `status` para distinguir 404/410/403 en la pantalla de aceptación: pasa a leerlo de `ApiError`.

- [ ] **Step 3: Verificar compilación y presupuestos**

Run: `cd frontend && pnpm build`
Expected: compila; ningún CSS de componente supera los 4 kB.

- [ ] **Step 4: Verificar que nada cambió**

Recorrer a mano: lista de proyectos, crear, renombrar, duplicar, archivar, abrir el editor, guardar, compilar, invitar, aceptar, y los estados de error de la pantalla de invitación (token inventado → "No encontramos esta invitación").
Expected: idéntico a antes. Este paso existe para que un fallo en la Tarea 7 no se confunda con un fallo del refactor.

- [ ] **Step 5: Commitear**

```bash
git add frontend/src/app/core/http frontend/src/app/features
git commit -m "refactor: unificar el helper HTTP de los servicios de datos"
```

---

## Task 7: Activar el cifrado en el cable

Deliverable: todo cuerpo JSON viaja cifrado en ambos sentidos. Es el paso que puede romper todo a la vez, y por eso va con los dos lados ya listos.

**Files:**
- Create: `backend/Presentation/Middleware/CryptoEnvelopeMiddleware.cs`, `backend/Presentation/Dtos/CipherEnvelopeDto.cs`
- Modify: `backend/Program.cs`, `frontend/src/app/core/http/api-client.ts`, `frontend/src/app/layouts/app-layout/app-layout.ts`

**Interfaces:**
- Consumes: `ICipherRegistry` (Tarea 1), el claim `SessionKey` (Tarea 4), `CryptoTransport` y `SessionKeyService` (Tarea 5), `ApiClient` (Tarea 6).
- Produces: `CipherEnvelopeDto` con `[JsonPropertyName]` `alg`, `v`, `iv`, `ct` y conversión desde/hacia `CipherEnvelope`.

- [ ] **Step 0: Crear `CipherEnvelopeDto`**

Los cuatro campos con `[JsonPropertyName("alg")]`, `("v")`, `("iv")`, `("ct")`, y la conversión en los dos sentidos con `CipherEnvelope`. Sin esto la política camelCase de `Program.cs` emitiría `algorithm`/`version` y el frontend no lo reconocería.

- [ ] **Step 1: Implementar el middleware**

Comportamiento completo en el spec §5.3. Los cuatro puntos que no se pueden equivocar:

- Rutas exentas: `/auth/*`, `/crypto/session`, `/swagger*`.
- **Sin claim de sesión, dejar pasar el cuerpo intacto** para que `[Authorize]` conteste `401` *(Review Focus #5)*.
- Cifrar **toda** respuesta `application/json`, sea cual sea su código, para que el frontend pueda leer los `{ error }`.
- El `400` propio va **en claro**, con `{ error = "La carga cifrada no es válida." }` y sin detalle criptográfico.

- [ ] **Step 2: Registrar el middleware en `Program.cs`**

`app.UseMiddleware<CryptoEnvelopeMiddleware>()` **después de `UseAuthentication()`/`UseAuthorization()` y antes de `MapControllers()`**. Antes de `UseAuthentication` el claim no existe todavía y nada funcionaría.

- [ ] **Step 3: Activar el cifrado en `ApiClient`**

Envolver el cuerpo con `CryptoTransport.wrap` al enviar y desenvolverlo con `unwrap` al recibir, **saltándose las rutas exentas** (la propia `/crypto/session`).

Si la clave de sesión todavía no está cargada, pedirla antes de la primera petición.

- [ ] **Step 4: Recuperarse de una clave obsoleta** *(Review Focus #4)*

En `ApiClient`: ante un `ApiError` con `status === 400` **y cuerpo en claro** (es decir, el `400` del middleware), **volver a pedir la clave de sesión una vez y reintentar la petición**. Si el reintento también falla, propagar el error.

Sin esto, volver a entrar en otra pestaña rota la pestaña vieja de forma permanente y sin explicación: el claim rota, la clave en memoria queda obsoleta, y todas las peticiones devuelven `400`.

- [ ] **Step 5: Cargar la clave al entrar y limpiarla al salir**

En `AppLayoutComponent`, junto al `auth.loadCurrentUser()` que ya hay en el constructor, llamar a `sessionKey.load()`. Si devuelve `401`, el `authGuard` ya se encarga de mandar a `/login`.

En el método `logout()` del mismo componente, llamar a `sessionKey.clear()` junto al `auth.clear()` que ya está. Dejar la clave en memoria tras cerrar sesión no tiene sentido y es el único consumidor de `clear()`.

- [ ] **Step 6: Verificar compilación de los dos lados**

Run: `cd backend && dotnet build` → `Build succeeded`.
Run: `cd frontend && pnpm build` → compila.

- [ ] **Step 7: Verificar que el tráfico va cifrado**

Editar `main.md` con una frase reconocible y guardar. En la pestaña Red de DevTools, mirar `PUT /api/projects/{p}/files/{f}/content`.
Expected: el cuerpo es `{alg,v,iv,ct}`; **buscar la frase del documento en el payload da cero resultados**. La respuesta también es un sobre.

- [ ] **Step 8: Verificar la aplicación completa**

Recorrer todo otra vez: lista, crear, renombrar, duplicar, archivar, editor, guardar, invitar, aceptar.
Expected: todo funciona. El PDF **todavía no** (va en la Tarea 8).

- [ ] **Step 9: Verificar que los mensajes de error siguen llegando**

Crear dos archivos con el mismo nombre en la misma carpeta (→ `409`).
Expected: la interfaz muestra "Ya existe un elemento con ese nombre en esta carpeta.", **no** el genérico "No fue posible completar la operación.". Si sale el genérico, el frontend no está descifrando los cuerpos de error.

- [ ] **Step 10: Verificar `401` frente a `400`** *(Review Focus #5)*

Borrar la cookie y, desde la consola, hacer un `PUT` de contenido con un cuerpo cualquiera.
Expected: `401`, **no** `400`.

- [ ] **Step 11: Verificar el sobre corrupto**

```js
await fetch('/api/projects/<P>/files/<F>/content', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ alg: 'AES-256-GCM', v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' }),
}).then(async r => [r.status, await r.text()])
```
Expected: `400` con `{"error":"La carga cifrada no es válida."}` en claro, **sin** traza ni mención de GCM, tags o claves.

- [ ] **Step 12: Verificar la recuperación de la clave obsoleta** *(Review Focus #4)*

Con la app abierta en una pestaña, iniciar sesión con la misma cuenta en otra (el claim rota). Volver a la primera y guardar un cambio.
Expected: funciona — el `ApiClient` pide la clave nueva y reintenta. Sin el Step 4, aquí empezarían a fallar todas las peticiones.

- [ ] **Step 13: Commitear**

```bash
git add backend/Presentation backend/Program.cs frontend/src/app/core frontend/src/app/layouts
git commit -m "feat: cifrar los cuerpos JSON entre frontend y backend"
```

---

## Task 8: El PDF cifrado

Deliverable: la compilación devuelve el PDF cifrado como JSON y el visor lo muestra igual que antes.

**Files:**
- Create: `backend/Presentation/Dtos/Responses/CompileResponse.cs`
- Modify: `backend/Presentation/Controllers/ProjectCompilationController.cs`, `frontend/src/app/features/editor/data-access/project-compilation.service.ts`

**Interfaces:**
- Consumes: el middleware (Tarea 7), `ApiClient` (Tarea 6).
- Produces: `POST /projects/{id}/compile` → `CompileResponse { string Pdf; }` (base64).

- [ ] **Step 1: Crear `CompileResponse` y cambiar el controller**

El `ProjectCompilationStatus.Success` pasa de `File(result.Pdf!, "application/pdf", "document.pdf")` a `Ok(new CompileResponse { Pdf = Convert.ToBase64String(result.Pdf!) })`. Los demás estados no cambian.

Al ser `application/json`, el middleware lo cifra con la maquinaria que ya existe: **cero código especial para binarios**.

- [ ] **Step 2: Adaptar `ProjectCompilationService` del frontend**

`compile()` pasa a usar `ApiClient`, recibe `{ pdf }` ya descifrado, decodifica el base64 a `Uint8Array` y devuelve `new Blob([bytes], { type: 'application/pdf' })`.

Quitar `response.blob()` y el header `Accept: application/pdf`. La firma sigue devolviendo `Promise<Blob>`, así que `EditorLayoutComponent` no cambia.

- [ ] **Step 3: Verificar compilación**

Run: `cd backend && dotnet build` y `cd frontend && pnpm build`
Expected: ambos compilan.

- [ ] **Step 4: Verificar que el PDF se ve y va cifrado**

Guardar `main.md` y mirar el visor. En la pestaña Red, la respuesta de `/compile`.
Expected: el PDF se renderiza; la respuesta es `application/json` con un sobre `{alg,v,iv,ct}`, **no** `application/pdf`, y no empieza por `%PDF`.

- [ ] **Step 5: Verificar un documento grande** *(Review Focus, tamaño)*

Pegar unas 2000 líneas de Markdown en `main.md`, guardar y compilar.
Expected: guarda y compila sin error. El base64 infla el payload ~33%; si algo revienta por tamaño, aquí se ve.

- [ ] **Step 6: Verificar el error de `main.md` ausente**

Borrar `main.md` y compilar.
Expected: el visor muestra "El proyecto no tiene un archivo principal main.md." — el `422` sigue llegando legible a través del cifrado.

- [ ] **Step 7: Commitear**

```bash
git add backend/Presentation frontend/src/app/features/editor
git commit -m "feat: devolver el PDF compilado cifrado como JSON"
```

---

## Task 9: Documentación

Deliverable: los READMEs explican el flujo, las claves y las advertencias de operación.

**Files:**
- Modify: `backend/README.md`, `frontend/README.md`, `TODO.md`

- [ ] **Step 1: Actualizar `backend/README.md`**

- Sección 1 (Stack): `pgcrypto` y AES-GCM vía `System.Security.Cryptography`.
- Sección 2 (árbol): `Infrastructure/Crypto/`, `Config/CryptoConfig.cs`, `Data/Sql/`, `Data/Database/EncryptedColumnStore.cs`, `Presentation/Middleware/`, `CryptoController`.
- **Sección nueva "Flujo de encriptación"**: las dos claves y sus orígenes, el sobre versionado, las rutas exentas y por qué, las dos columnas cifradas y **por qué las otras tres no lo están**.
- Sección 5 (endpoints): `GET /crypto/session`, y que `/compile` ahora devuelve JSON.
- Sección 7 (ejecución): `CRYPTO_MASTER_KEY` (generada con `openssl rand -base64 32`), `APP_DB_USER`/`APP_DB_PASSWORD`, y que **`00-bootstrap.sql` se ejecuta una vez como superusuario** porque `Migrate()` no puede crear extensiones ni roles.
- **Dos advertencias de operación:** no habilitar el log de parámetros en PostgreSQL (la clave maestra acabaría en el log junto al ciphertext que protege), y el "Try it out" de Swagger ya no sirve para las rutas de datos.
- Sección 9: mover el flujo de encriptación a "listo".

- [ ] **Step 2: Actualizar `frontend/README.md`**

- Sección 1 (Stack): Web Crypto.
- Sección 2 (árbol): `core/crypto/` y `core/http/api-client.ts`.
- Sección 3 (convenciones): **el `request<T>()` ya no se duplica** — todo pasa por `ApiClient`, y ahí vive el cifrado.
- Nota de que la clave de sesión vive **solo en memoria**, y por qué no en `localStorage`.
- Sección 9: actualizar pendientes.

- [ ] **Step 3: Actualizar `TODO.md`**

Mover el flujo de encriptación a "FUNCIONALIDADES LISTAS".

- [ ] **Step 4: Commitear**

```bash
git add backend/README.md frontend/README.md TODO.md
git commit -m "docs: documentar el flujo de encriptacion en tres capas"
```
