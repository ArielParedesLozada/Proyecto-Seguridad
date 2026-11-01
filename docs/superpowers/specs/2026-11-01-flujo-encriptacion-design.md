# Diseño: flujo de encriptación en tres capas

**Fecha:** 2026-11-01
**Estado:** pendiente de aprobación
**Repositorio:** clon de Overleaf (backend .NET 8 + frontend Angular 22 + PostgreSQL)
**Requisito de origen:** `TODO.md` líneas 24–38 y la sección "FLUJO DE ENCRIPTACION" del `README.md` raíz

---

## 1. Intención y por qué

El requisito pide que los datos estén cifrados en los tres puntos del recorrido —
navegador, API y base de datos — y que el algoritmo esté detrás de una
abstracción, porque más adelante se va a sustituir por uno propio.

El flujo especificado, literal:

1. El frontend envía los datos cifrados al backend.
2. El backend recibe cifrado, descifra, procesa y envía los datos a la base.
3. La base recibe los datos y los cifra para almacenarlos.
4. Cuando el backend pide datos, la base los entrega cifrados.
5. El backend descifra, procesa y envía cifrado al frontend.
6. El frontend recibe cifrado, procesa y muestra los datos al usuario.

### Qué es y qué no es este diseño

**No es cifrado extremo a extremo, y no puede serlo.** El paso 2 dice
explícitamente "descifra, procesa": el backend necesita texto claro porque
compila el Markdown a PDF, valida nombres de archivo y decide autorización. El
backend es, por diseño, una parte confiable que ve el contenido.

Lo que el flujo sí consigue, y es lo que hay que defender:

- **Dos capas independientes de cifrado**, con **dos claves distintas de dos
  orígenes distintos**: una de sesión para el tramo navegador↔API, y una maestra
  para el almacenamiento. Comprometer una no da acceso a la otra.
- **El payload sigue cifrado más allá de TLS.** TLS protege el cable; esta capa
  protege el cuerpo de la petición en un log de acceso, en un proxy inverso, o en
  cualquier punto donde TLS se termine antes del backend.
- **La base de datos no guarda el contenido en claro.** Quien obtenga las
  credenciales de la base, un dump o el disco, obtiene ciphertext.
- **El rol de la aplicación no puede leer las columnas cifradas directamente.**
  Solo puede ejecutar las funciones que las cifran y descifran (esto es el
  "NO USAR ADMIN PARA TODO" del README raíz).

---

## 2. Objetivos, no-objetivos, anti-objetivos

### Objetivos

1. Todo cuerpo JSON entre frontend y backend viaja cifrado en ambos sentidos, con
   una lista corta y justificada de rutas exentas.
2. El contenido de los documentos y los nombres de proyecto se almacenan cifrados,
   y **el cifrado lo hace la base**, dentro de funciones SQL.
3. El algoritmo es sustituible en las tres capas sin tocar la lógica de negocio, y
   **sin perder los datos ya cifrados** con el algoritmo anterior.
4. La clave del navegador no está en el bundle: se entrega por el canal
   autenticado y vive solo en memoria.
5. El rol de PostgreSQL de la aplicación no tiene acceso directo a las columnas
   cifradas.

### No-objetivos (fuera de alcance)

- Cifrado extremo a extremo con el backend como parte no confiable.
- Rotación automática de la clave maestra (sí se diseña el sobre para que sea
  posible; el procedimiento de rotación no se implementa).
- Cifrado de los metadatos que la base usa como clave de búsqueda — ver §5.4, es
  una decisión explícita y razonada, no un olvido.
- Firmas digitales, no-repudio, ni auditoría de cambios (eso es otro punto del
  `TODO.md`).
- Gestión de claves con un KMS o HSM. La clave maestra vive en `.env`.

### Anti-objetivos (señales de que salió mal)

- Que la clave de cifrado del frontend acabe en `main.js`, en `localStorage`, o en
  cualquier sitio legible sin estar autenticado.
- Que al cambiar de algoritmo los datos existentes queden ilegibles.
- Que el cifrado quede como una capa decorativa que el middleware aplica pero que
  cualquiera puede deshacer con información pública.
- Que la clave maestra aparezca en los logs de PostgreSQL o en el texto de una
  consulta.
- Que para que el cifrado funcione haya que dar permisos amplios al rol de la
  aplicación, anulando el objetivo 5.

---

## 3. Restricciones

- Arquitectura y convenciones de `backend/README.md` y `frontend/README.md`.
  **Leer ambos antes de escribir código.**
- Backend: .NET 8, EF Core 8, Npgsql. Criptografía con `System.Security.Cryptography`
  (`AesGcm` está en la BCL; no hace falta paquete nuevo).
- Frontend: sin `HttpClient` ni RxJS. Criptografía con **Web Crypto**
  (`crypto.subtle`), que es nativa del navegador — tampoco hace falta dependencia.
- Base: PostgreSQL con la extensión **`pgcrypto`**.
- `Program.cs` ejecuta `Migrate()` al arrancar y la app no tiene modo degradado:
  si falta configuración obligatoria, no arranca.
- El frontend ya tiene el patrón `request<T>()` **duplicado en tres servicios**
  (`project`, `project-file`, `invitation`). Es el punto de integración.

---

## 4. Enfoques considerados

| Enfoque | Qué implica | Trade-off |
|---|---|---|
| **A. Sobre uniforme en todo el tráfico de datos** *(elegido)* | Middleware en el backend que descifra la petición antes del controller y cifra la respuesta al salir; helper compartido en el frontend. Exenciones: solo `/auth/*` y `/crypto/session`. El PDF también va cifrado, devuelto como JSON (§5.3). | Cumple los seis pasos al pie de la letra y es lo más fácil de defender: no queda ninguna ruta de datos en claro. Cuesta un middleware, extraer el helper compartido, y rompe el "Try it out" de Swagger. |
| B. Cifrado selectivo de campos sensibles | Solo el contenido de archivos y los nombres de proyecto viajan en sobre; el resto del JSON va en claro bajo TLS. | Bastante menos trabajo, y los tres niveles quedan igualmente demostrados. Pero el spec dice "los datos", no "algunos datos": habría que argumentar por qué el rol de un miembro no merece cifrado. |
| C. Cifrar absolutamente todo, sin excepciones | Incluido `/auth/*` y el redirect de OAuth. | **Imposible.** El redirect de Google es navegación del navegador, no una petición interceptable, y la clave de sesión se entrega por `/crypto/session`: cifrarla con la clave que todavía no tienes es un bucle. |

**Decisión: A.**

### Decisión de producto confirmada: origen de la clave del navegador

Se consideró poner la clave en una variable de entorno del frontend. **Se
descartó por una razón técnica, no de preferencia:** Angular resuelve las
variables de entorno en tiempo de compilación, así que el valor queda incrustado
en `main.js` y es legible con las DevTools. Una clave pública no cifra nada: quien
capture un payload lo descifra.

La clave de sesión se entrega por el canal ya autenticado (§5.2).

---

## 5. El cómo, ya decidido

### 5.0 Las dos claves

El diseño tiene **dos claves con ciclos de vida y amenazas distintas**. No
mezclarlas es la mitad del valor del diseño.

| | `K_session` | `K_master` |
|---|---|---|
| Protege | El tramo navegador ↔ API | El almacenamiento en la base |
| Tamaño | 32 bytes (AES-256) | 32 bytes |
| Origen | Generada por el backend en cada login | `CRYPTO_MASTER_KEY` en `backend/.env` |
| Vive en | Claim de la cookie de sesión (cifrada por Data Protection) + memoria del navegador | Entorno del proceso backend |
| Vida | La de la sesión (7 días, deslizante); rota en cada login | Fija; rotarla es un procedimiento manual fuera de alcance |
| Quién la conoce | Backend y ese navegador | Backend y, transitoriamente, la base durante la llamada |

El backend es el único lugar donde existen las dos. Eso es exactamente lo que lo
convierte en la parte confiable del diseño.

### 5.1 El sobre versionado — la pieza que hace posible cambiar el algoritmo

Si el ciphertext no dice con qué fue cifrado, el día que se sustituya el algoritmo
los datos existentes quedan ilegibles. El sobre lo resuelve.

**En el cable (JSON):**

```json
{ "alg": "AES-256-GCM", "v": 1, "iv": "<base64>", "ct": "<base64>" }
```

`ct` lleva el tag de autenticación GCM **concatenado al final del ciphertext**,
que es como lo produce y lo espera Web Crypto. .NET lo necesita separado, así que
el `AesGcmCipher` del backend parte los últimos 16 bytes al descifrar y los
concatena al cifrar. Esto es la fuente de error más probable de toda la
implementación: si el frontend y el backend no se ponen de acuerdo en dónde va el
tag, todo falla con "authentication failed" y el mensaje no dice por qué.

**En la base (`bytea`):** un byte de prefijo con el identificador de algoritmo,
seguido del ciphertext.

```
\x01 || pgp_sym_encrypt(...)     -- 0x01 = pgcrypto/AES, el actual
\x02 || <tu algoritmo>           -- reservado para el futuro
```

Las funciones de descifrado hacen `CASE` sobre ese primer byte. Añadir un
algoritmo es añadir una rama, no migrar datos.

### 5.2 Capa 1 — la clave de sesión

**Al iniciar sesión** (`Config/AuthConfig.cs`, dentro del `OnCreatingTicket` que
ya existe y ya añade el claim `UserId`):

```csharp
var sessionKey = RandomNumberGenerator.GetBytes(32);
identity.AddClaim(new Claim(AuthClaimTypes.SessionKey, Convert.ToBase64String(sessionKey)));
```

Nueva constante en `App/Auth/AuthClaimTypes.cs`:
`public const string SessionKey = "session_key";`

La cookie `overleaf_session` ya está cifrada y firmada por ASP.NET Core Data
Protection, así que el claim viaja protegido y **no hace falta tabla ni estado en
el servidor**. Son 44 caracteres en base64; el tamaño de la cookie no es problema.

**El frontend la obtiene** con `GET /crypto/session` (autenticado), que devuelve:

```json
{ "key": "<base64>", "algorithm": "AES-256-GCM", "version": 1 }
```

Esta ruta está **exenta de cifrado** por necesidad: es de donde sale la clave.

El frontend la guarda **en memoria**, en una signal de un servicio `core/crypto/`.
Nunca en `localStorage` ni en `sessionStorage`: ahí sobreviviría al cierre de la
pestaña y sería legible por cualquier script de la página.

**Cookies anteriores a esta funcionalidad no tienen el claim.** En ese caso
`/crypto/session` devuelve `401` y el frontend manda al usuario a `/login`. No hay
migración de sesiones: volver a entrar con Google es suficiente.

### 5.3 Capa 2 — el middleware del backend

`Presentation/Middleware/CryptoEnvelopeMiddleware.cs`. Se registra en `Program.cs`
**después de `UseAuthentication()`** — necesita el claim — y **antes de
`MapControllers()`**.

- **Petición:** si la ruta no está exenta y hay cuerpo, lo lee, deserializa el
  sobre, lo descifra con `K_session` y **sustituye `HttpContext.Request.Body`** por
  un `MemoryStream` con el texto claro. Los controllers y servicios no se enteran:
  siguen recibiendo sus DTOs de siempre.
- **Respuesta:** envuelve el `Response.Body` en un `MemoryStream`, deja correr el
  pipeline, y si el resultado es `application/json`, lo cifra y escribe el sobre.

**Rutas exentas** (constante en el middleware, con comentario de la razón):

| Ruta | Razón |
|---|---|
| `/auth/*` | El login es navegación del navegador y el redirect de OAuth no es interceptable |
| `/crypto/session` | Es el origen de la clave |
| `/swagger*` | Solo existe en Development |

**El PDF también va cifrado**, y la forma de conseguirlo evita tener que tratar
binarios en el middleware: `ProjectCompilationController` deja de devolver
`File(pdf, "application/pdf", ...)` y devuelve **JSON** con los bytes en base64:

```csharp
return Ok(new CompileResponse { Pdf = Convert.ToBase64String(result.Pdf!) });
```

Al ser `application/json`, el middleware lo cifra con la misma maquinaria que todo
lo demás — cero código especial para binarios. En el frontend,
`ProjectCompilationService.compile()` pasa a usar el helper compartido, decodifica
el base64 a `Uint8Array` y construye el `Blob` con
`new Blob([bytes], { type: 'application/pdf' })`. El resto de
`EditorLayoutComponent` (el `createObjectURL`, el `revokeObjectURL`) no cambia.

El coste es ~33% más de payload por el base64. Para un PDF de unos cientos de KB
es irrelevante, y a cambio no hay ninguna ruta de datos sin cifrar.
*(Decidido por el dueño del proyecto.)*

**Si el claim de sesión no está** (petición sin autenticar a una ruta de datos),
el middleware **deja pasar el cuerpo intacto** y no intenta descifrar. Así el
`[Authorize]` del controller devuelve el `401` que corresponde, en lugar de un
`400` por "sobre inválido" que confundiría el diagnóstico. El middleware corre
antes de los filtros de MVC, así que sin esta regla toda petición no autenticada
se reportaría como error de cifrado. *(Decisión del diseñador, no discutida.)*

**Errores:** un sobre mal formado o que no descifra devuelve **`400`** con
`{ error = "La carga cifrada no es válida." }` **sin detalle criptográfico**. No
distinguir entre "el sobre está mal" y "el tag no valida": esa distinción es un
oráculo para un atacante.

**Los cuerpos de error también van cifrados** — con una excepción. El helper del
frontend lee `{ error }` de las respuestas fallidas para mostrar el mensaje, así
que el middleware cifra **toda** respuesta `application/json` sea cual sea su
código, y el frontend descifra antes de leer el error. La excepción es el `400`
que genera el propio middleware: ese va **en claro**, porque si el fallo viene de
una clave equivocada el cliente tampoco podría descifrar la explicación.
*(Decisión del diseñador, no discutida.)*

Si esto se implementa mal el síntoma es engañoso: los errores de la API aparecen
en la interfaz como el genérico "No fue posible completar la operación." en lugar
del mensaje real, y parece un problema de la API cuando es del descifrado.

**Swagger deja de servir para las rutas de datos.** El "Try it out" enviaría JSON
en claro y recibiría `400`. Es consecuencia aceptada del enfoque A; se documenta
en el README.

### 5.4 Capa 3 — la base de datos

**La extensión y el rol se crean una sola vez, a mano.** `Migrate()` corre con el
rol de la aplicación, que no puede crear extensiones ni roles — eso necesita
superusuario. Por eso hay un script de arranque que un humano ejecuta una vez:

`backend/Data/Sql/00-bootstrap.sql` (documentado en el README, no lo ejecuta la app):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE overleaf_app LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE overleaf TO overleaf_app;
GRANT USAGE ON SCHEMA public TO overleaf_app;
```

**Las funciones las crea una migración de EF Core** (con `migrationBuilder.Sql`),
porque son parte del esquema y deben versionarse con él:

```sql
CREATE SCHEMA IF NOT EXISTS app_crypto;

CREATE OR REPLACE FUNCTION app_crypto.encrypt_text(plaintext text, key text)
RETURNS bytea LANGUAGE sql SECURITY DEFINER AS $$
  SELECT '\x01'::bytea || pgp_sym_encrypt(plaintext, key, 'cipher-algo=aes256');
$$;

CREATE OR REPLACE FUNCTION app_crypto.decrypt_text(payload bytea, key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  CASE get_byte(payload, 0)
    WHEN 1 THEN RETURN pgp_sym_decrypt(substring(payload from 2), key);
    ELSE RAISE EXCEPTION 'Algoritmo de cifrado desconocido: %', get_byte(payload, 0);
  END CASE;
END;
$$;
```

**`SECURITY DEFINER` es la pieza clave del objetivo 5.** La función corre con los
privilegios de su propietario, así que el rol de la aplicación puede cifrar y
descifrar **sin tener `SELECT` sobre las columnas cifradas**. Los permisos:

```sql
REVOKE ALL ON FUNCTION app_crypto.encrypt_text(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_crypto.decrypt_text(bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_crypto.encrypt_text(text, text) TO overleaf_app;
GRANT EXECUTE ON FUNCTION app_crypto.decrypt_text(bytea, text) TO overleaf_app;
```

Y las columnas cifradas se excluyen por **permisos a nivel de columna**, que
PostgreSQL soporta:

```sql
GRANT SELECT (id, project_id, parent_id, name, type, created_at, updated_at)
  ON project_files TO overleaf_app;
-- content_cipher queda deliberadamente fuera
```

#### Qué columnas se cifran, y por qué no todas

**Esta es la restricción más importante de toda la capa de datos: cifrar una
columna rompe cualquier consulta que la filtre o la indexe.** `pgp_sym_encrypt`
es no determinista (IV aleatorio), así que `WHERE email_cipher = encrypt('x')`
nunca encuentra nada.

| Columna | ¿Se cifra? | Por qué |
|---|---|---|
| `project_files.content` | **Sí** | Es el contenido real del documento. Solo se lee y escribe completo, nunca se filtra. Candidato perfecto. |
| `projects.name` | **Sí** | Se muestra y se ordena, pero **en el cliente** — `ProjectListComponent` filtra y ordena con signals. No hay `WHERE` ni `ORDER BY` sobre él en el servidor. |
| `project_files.name` | No | `HasDuplicateNameAsync` y la búsqueda de `main.md` de `ProjectCompilationService` filtran por igualdad sobre él. |
| `project_invitations.email` | No | Se busca por igualdad en la comprobación de duplicados y al aceptar. |
| `users.email` | No | Tiene índice `UNIQUE` y es la clave de búsqueda del login. |

Cifrar las tres últimas exigiría una columna de hash determinista al lado para
las búsquedas — lo que **filtra la igualdad** (se puede saber que dos filas tienen
el mismo correo sin descifrar nada) y es scope que el requisito no pide. **Si te
preguntan por qué el correo no está cifrado, esa es la respuesta: porque es clave
de búsqueda, y cifrarlo manteniendo la búsqueda introduce una fuga que decidimos
no introducir.** Está en el documento para que sea una decisión defendida y no un
descuido.

#### Cómo llega `K_master` a las funciones

Como **parámetro de consulta enlazado** (`FromSqlInterpolated` / `ExecuteSql...`),
nunca interpolado en el texto del SQL. Npgsql lo envía como bind parameter, así
que no aparece en el texto de la sentencia.

> **Advertencia de configuración:** no habilitar el log de parámetros en
> PostgreSQL (`log_parameter_max_length`, o `log_statement = 'all'` combinado con
> logging de parámetros en errores). Con eso la clave maestra acabaría en el log,
> junto al ciphertext que protege. Va en el README.

#### Cambios de esquema

| Tabla | Antes | Después |
|---|---|---|
| `project_files` | `content text` | `content_cipher bytea` |
| `projects` | `name text` | `name_cipher bytea` |

Las entidades de `Domain/Models/` **no cambian**: `ProjectFile.Content` y
`Project.Name` siguen siendo `string` en C#. La traducción vive en la capa de
datos (§5.5).

**Los datos actuales se descartan: se parte de base limpia.** *(Decidido por el
dueño del proyecto.)* Una sola migración elimina las columnas de texto y añade las
`bytea` — no hay backfill, ni servicio de migración de datos, ni segunda
migración. El procedimiento antes de implementar: borrar la base, dejar que
`Migrate()` la recree desde cero, y volver a crear un proyecto de prueba.

> Esto implica perder los proyectos y las invitaciones aceptadas que haya ahora.
> Es la decisión tomada a cambio de quitar una tarea entera del plan. Si más
> adelante hiciera falta cifrar datos existentes en un entorno con datos reales,
> el camino sería: migración que añade las columnas nullable → servicio idempotente
> que rellena al arrancar → migración que borra las de texto. No se implementa aquí.

### 5.5 El acceso a las columnas cifradas desde el backend

El rol de la aplicación no puede leer `content_cipher` ni `name_cipher`
directamente, así que EF Core no puede proyectarlas en un `Select`. Los puntos de
acceso pasan por SQL explícito.

Nuevo repositorio en la capa de datos: `Data/Database/EncryptedColumnStore.cs`,
inyectable, con `AppDatabase` y la clave maestra:

```csharp
Task<string?> ReadProjectFileContentAsync(Guid fileId, CancellationToken ct);
Task WriteProjectFileContentAsync(Guid fileId, string? content, CancellationToken ct);
Task<Dictionary<Guid, string>> ReadProjectNamesAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken ct);
Task WriteProjectNameAsync(Guid projectId, string name, CancellationToken ct);

/// <summary>
/// Copia el ciphertext de un archivo a otro SIN descifrarlo. Para duplicar un
/// proyecto no hace falta ver el contenido: es un bytea → bytea.
/// </summary>
Task CopyProjectFileContentAsync(Guid sourceFileId, Guid targetFileId, CancellationToken ct);
```

La lectura en lote de nombres existe para evitar el N+1 en la lista de proyectos:
`GetProjectsAsync` devuelve muchas filas y cada una necesita su nombre descifrado.

`CopyProjectFileContentAsync` existe porque duplicar un proyecto **no necesita el
texto claro**: copiar el ciphertext tal cual es más barato, y mantiene el
contenido fuera del proceso del backend en una operación que puede mover muchos
archivos de golpe. *(Decisión del diseñador, no discutida.)*

**Servicios afectados** (los demás no se tocan):

- `ProjectFileService` — `GetFileAsync` y `UpdateContentAsync` leen y escriben el
  contenido por el store. `CreateFileAsync` escribe el contenido inicial vacío.
- `ProjectService` — `GetProjectsAsync`, `GetProjectAsync`, `CreateProjectAsync`,
  `UpdateProjectAsync` pasan el nombre por el store. `CopyProjectAsync` usa
  `CopyProjectFileContentAsync` para los archivos y el store solo para el nombre
  del proyecto nuevo (`"{origen} - Copia"`, que sí necesita descifrar el original).
- `ProjectCompilationService` — lee el contenido de `main.md` por el store.
  Ojo: sigue localizando el archivo por `Name == "main.md"`, que **no** está
  cifrado, así que ese filtro no cambia.
- **`ProjectInvitationService`** — lee `project.Name` en seis sitios: el asunto y
  el cuerpo del correo de invitación, los mismos dos al reenviar, y
  `InvitationPreviewResponse.ProjectName` en el preview y en la aceptación. Todos
  pasan por el store. **Es el servicio que más fácil se olvida**, porque el
  cifrado no tiene nada que ver con las invitaciones — pero si se olvida, los
  correos salen con el nombre del proyecto vacío y la pantalla de aceptación no
  dice a qué proyecto te invitan.

`GetProjectsAsync` hoy devuelve `IAsyncEnumerable<ProjectResponse>` en streaming.
Con el descifrado en lote **deja de poder ser streaming** y pasa a `Task<List<...>>`.
El controller cambia de `Ok(IAsyncEnumerable)` a `Ok(List)`; el JSON que ve el
frontend es idéntico.

### 5.6 La abstracción del cifrador — backend

`Domain/Services/ICipher.cs` — cero dependencias de framework, como el resto de
`Domain/`:

```csharp
public record CipherEnvelope(string Algorithm, int Version, string Iv, string CipherText);

public interface ICipher
{
    string Algorithm { get; }
    int Version { get; }
    CipherEnvelope Encrypt(string plaintext, byte[] key);
    string Decrypt(CipherEnvelope envelope, byte[] key);
}
```

`Domain/Services/ICipherRegistry.cs` — **esto es lo que hace que el cambio de
algoritmo funcione**:

```csharp
public interface ICipherRegistry
{
    ICipher Current { get; }                    // con el que se cifra hoy
    ICipher Resolve(string algorithm, int version);  // con el que se descifra lo viejo
}
```

Se cifra siempre con `Current`; se descifra con el que el sobre nombre. Añadir un
algoritmo es registrar una implementación más, sin tocar nada que ya funcione.

`Infrastructure/Crypto/AesGcmCipher.cs` implementa `ICipher` con `AesGcm`
(IV de 12 bytes aleatorio por operación, tag de 16 bytes).
`Infrastructure/Crypto/CipherRegistry.cs` implementa el registro.

`Config/CryptoConfig.cs` con `AddCrypto(masterKeyBase64)`: registra
`ICipherRegistry` y `AesGcmCipher` como **Singleton** (no tienen estado por
petición), el `EncryptedColumnStore` como `Scoped`, y lanza
`InvalidOperationException` si `CRYPTO_MASTER_KEY` falta o no son 32 bytes — mismo
criterio que `AuthConfig` y `MailConfig`.

### 5.7 La abstracción del cifrador — frontend

`core/crypto/`:

| Archivo | Responsabilidad |
|---|---|
| `cipher.interface.ts` | `CipherEnvelope` y `Cipher`, espejo del backend |
| `aes-gcm.cipher.ts` | Implementación con `crypto.subtle` |
| `cipher-registry.ts` | `current` y `resolve(alg, v)` |
| `session-key.service.ts` | Pide `GET /crypto/session`, guarda la clave en una signal |
| `crypto-transport.ts` | Envuelve y desenvuelve; lo usa el helper HTTP |

Web Crypto es **asíncrono** (`crypto.subtle.encrypt` devuelve una promesa) y los
servicios del frontend ya son `async`, así que encaja sin fricción.

`crypto.subtle` **solo existe en navegador** y solo bajo contexto seguro
(`localhost` cuenta). Todo el código que lo toque va detrás de
`isPlatformBrowser`, como el resto del proyecto.

**El helper HTTP compartido** es el cambio estructural: hoy `request<T>()` está
duplicado en `project.service.ts`, `project-file.service.ts` e
`invitation.service.ts`. Se extrae a `core/http/api-client.ts`, con el cifrado
dentro, y los tres servicios pasan a usarlo. Un sitio, no tres.

`ProjectCompilationService.compile()` **pasa a usar el helper compartido** como
los demás: recibe `{ pdf: "<base64>" }` ya descifrado y construye el `Blob` a
partir de los bytes decodificados. Deja de llamar a `response.blob()` y de poner
el header `Accept: application/pdf`, porque la respuesta ahora es JSON (§5.3).

### 5.8 Presentation

`Presentation/Controllers/CryptoController.cs`:

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/crypto/session` | sesión | `SessionKeyResponse` o `401` si falta el claim |

`Presentation/Dtos/Responses/SessionKeyResponse.cs`:

```csharp
public class SessionKeyResponse
{
    public string Key { get; set; } = string.Empty;        // base64, 32 bytes
    public string Algorithm { get; set; } = string.Empty;  // "AES-256-GCM"
    public int Version { get; set; }
}
```

El `userId` sale del claim con el helper `TryGetCurrentUserId` canónico, igual que
en todos los demás controllers.

`Presentation/Dtos/Responses/CompileResponse.cs` (nuevo, para el PDF en JSON):

```csharp
public class CompileResponse
{
    public string Pdf { get; set; } = string.Empty;   // base64 de los bytes del PDF
}
```

### 5.9 Configuración nueva

`backend/.env` (ya está en `.gitignore`):

```
CRYPTO_MASTER_KEY=<32 bytes en base64>
APP_DB_USER=overleaf_app
APP_DB_PASSWORD=<contraseña del rol restringido>
```

La clave se genera con `openssl rand -base64 32`. `CONNECTION_STRING` pasa a usar
el rol restringido; el script de bootstrap se ejecuta con el rol administrador una
sola vez, a mano.

---

## 6. Verificación

No hay suite automatizada en el repositorio (el backend no tiene proyecto de test
y el frontend solo trae el `app.spec.ts` del CLI), así que la verificación es
manual y **hay que ejecutarla de verdad**:

1. `dotnet build` y `pnpm build` sin errores ni warnings nuevos.
2. **La clave no está en el bundle:** `pnpm build && grep -r "CRYPTO\|masterKey" dist/`
   no devuelve nada. Contraste explícito con la opción descartada.
3. **El tráfico va cifrado:** en la pestaña Red de DevTools, el cuerpo de
   `PUT /api/projects/{id}/files/{id}/content` es `{alg,v,iv,ct}` y no contiene el
   texto del documento. Buscar una frase del documento en el payload: cero
   resultados.
4. **La base guarda ciphertext:**
   `psql -c "select content_cipher from project_files limit 1"` devuelve bytea que
   empieza por `\x01`, no texto legible.
5. **El rol restringido no puede leer la columna:** conectado como `overleaf_app`,
   `select content_cipher from project_files` falla con "permission denied for
   column". Esta es la prueba del objetivo 5.
6. **El descifrado por la base funciona:** conectado como `overleaf_app`,
   `select app_crypto.decrypt_text(...)` sí funciona (vía `SECURITY DEFINER`).
7. **Extremo a extremo:** crear proyecto, editar `main.md`, `Ctrl+S`, recargar la
   página y ver el contenido correcto.
7b. **El PDF va cifrado y se ve:** compilar y comprobar que el PDF se renderiza en
   el visor. En la pestaña Red, la respuesta de `/compile` es un sobre
   `{alg,v,iv,ct}` con `Content-Type: application/json` — **no**
   `application/pdf`, y no empieza por `%PDF`.
8. **El sobre versionado sobrevive:** insertar a mano una fila con prefijo `\x02` y
   comprobar que `decrypt_text` falla con el mensaje de algoritmo desconocido en
   lugar de devolver basura.
9. **Sesión sin clave:** borrar la cookie, llamar a `/crypto/session` → `401`, y
   comprobar que el frontend redirige a `/login`.
10. **Sobre corrupto:** enviar `{"alg":"AES-256-GCM","v":1,"iv":"AAA","ct":"AAA"}`
    → `400` con el mensaje genérico, sin detalle criptográfico y sin traza en la
    respuesta.
11. **Las invitaciones siguen funcionando** (la funcionalidad recién terminada):
    invitar, recibir el correo, aceptar, abrir el proyecto. El flujo de aceptación
    pasa por el middleware.

---

## 7. Orden de implementación

De adentro hacia afuera, con una regla: **cada capa se verifica antes de construir
la siguiente**, porque un fallo de cifrado se manifiesta como "authentication
failed" sin pista de dónde está.

1. `ICipher`, `ICipherRegistry`, `AesGcmCipher`, `CipherRegistry`, `CryptoConfig`,
   `CRYPTO_MASTER_KEY`. Verificar con un ida y vuelta en memoria.
2. **Borrar la base.** Script de bootstrap (extensión + rol), migración con el
   esquema `app_crypto`, las funciones, los permisos y las columnas `*_cipher`.
   Verificar desde `psql`.
3. `EncryptedColumnStore` + adaptación de `ProjectFileService`, `ProjectService`,
   `ProjectCompilationService` y **`ProjectInvitationService`**. Verificar que la
   app sigue funcionando completa **sin cifrado en el cable todavía** — incluido
   enviar y aceptar una invitación.
4. Claim de sesión + `CryptoController` + `/crypto/session`.
5. `core/crypto/` del frontend y el `api-client.ts` compartido, **descifrando solo
   la respuesta de `/crypto/session`**. Verificar que la clave llega.
6. Middleware del backend y activación del cifrado en el helper del frontend. Es
   el paso que puede romper todo a la vez: hacerlo último y con los dos lados
   listos.
7. El PDF por JSON: `CompileResponse` en el controller y el decodificado en
   `ProjectCompilationService.compile()` del frontend.
8. Actualizar los dos READMEs y `TODO.md`.

---

## 8. Decisiones que quedan al constructor

- Nombres exactos de métodos privados y orden interno de las validaciones.
- Si `EncryptedColumnStore` usa `FromSqlInterpolated` o `ExecuteSqlInterpolated`
  para cada operación.
- Textos exactos de los mensajes de error, en español y con el tono existente.
- Si el middleware loguea los fallos de descifrado (recomendado, a nivel
  `Warning` y **sin incluir el payload**).

---

## 9. Lo que esto deja preparado

El sobre versionado y el `ICipherRegistry` son la infraestructura para el algoritmo
propio: implementar `ICipher` con él, registrarlo como `Current`, añadir la rama
`\x02` a `decrypt_text`, y los datos viejos siguen leyéndose. Ese es el requisito
de "arquitectura limpia" del `TODO.md`, hecho de forma que se pueda demostrar y no
solo afirmar.
