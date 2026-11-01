# FRONTEND

SPA en **Angular 22** (standalone, signals, zoneless-friendly) del proyecto de
Seguridad (clon de Overleaf con Markdown → PDF).

> Este README es la referencia de arquitectura para humanos **y para agentes de IA**.
> Antes de escribir código, lee "Convenciones obligatorias" y "Cómo agregar una
> funcionalidad". El árbol de la sección 2 es el **estado real** del repositorio.

---

## 1. Stack

| Pieza | Elección |
|---|---|
| Framework | Angular 22, **componentes standalone** (no hay NgModules) |
| Estado | **Signals** (`signal`, `computed`, `effect`, `input()`, `output()`, `model()`) |
| HTTP | **`fetch` nativo + `async/await`** — *no* se usa `HttpClient` ni RxJS |
| UI | PrimeNG 22 + tema `@primeng/themes` Aura con preset propio (`ChiperTexPreset`) |
| Estilos | Tailwind CSS 4 (vía `@tailwindcss/postcss`) + CSS por componente + tokens en `src/styles.css` |
| Iconos | `@lucide/angular` (componentes standalone importados uno por uno) |
| Cifrado | Web Crypto (`crypto.subtle`), nativo del navegador — sin dependencia nueva |
| Tests | Vitest (`ng test`) |
| Paquetes | **pnpm** (`packageManager: pnpm@11.20.0`) |

---

## 2. Estructura real del proyecto

```text
frontend/
├── angular.json                 # builder @angular/build:application; serve usa proxy.conf.json
├── proxy.conf.json              # /api -> http://localhost:5282, reescribe ^/api a ''
├── .prettierrc                  # printWidth 100, singleQuote, parser angular para .html
├── public/
│   ├── images/                  # LogoIcono.png, LogoLatex.png, LogoGoogle.png, …
│   └── runtime-config.example.js  # copiar a runtime-config.js con la licencia de PrimeUI
└── src/
    ├── index.html               # carga runtime-config.js antes de <app-root>
    ├── main.ts                  # bootstrapApplication(App, appConfig)
    ├── styles.css               # @import 'tailwindcss' + tokens CSS (:root y :root.app-dark)
    ├── main.server.ts  server.ts  app.config.server.ts  app.routes.server.ts
    │                            # Andamiaje SSR presente pero NO conectado en angular.json
    └── app/
        ├── app.ts / app.html / app.css        # shell: solo <router-outlet>
        ├── app.config.ts                      # provideRouter + providePrimeNG(preset)
        ├── app.routes.ts                      # TODAS las rutas, eager (sin lazy loading)
        │
        ├── core/                              # singletons y constantes globales
        │   ├── auth/auth.service.ts            # signal del usuario actual + /auth/me
        │   ├── auth/auth.guard.ts              # CanActivateFn asíncrono contra /auth/me
        │   ├── constants/api.constants.ts      # API_ROUTES: única fuente de URLs
        │   ├── crypto/                          # cipher.interface, aes-gcm.cipher, cipher-registry,
        │   │                                    # session-key.service, crypto-transport (ver §5b)
        │   ├── http/api-client.ts               # request<T>() compartido; el cifrado vive aquí
        │   ├── services/theme.service.ts       # signal darkMode + clase .app-dark en <html>
        │   └── shortcuts/                      # KEYBOARD_SHORTCUTS + KeyboardShortcutService
        │
        ├── shared/components/                 # ~40 componentes ui-* presentacionales
        │   ├── ui-button/  ui-modal/  ui-table/  ui-tabs/  ui-split-pane/
        │   ├── ui-form-field/  ui-search-input/  ui-tooltip/  ui-empty-state/
        │   ├── ui-confirm-dialog/  ui-modal-actions/  ui-brand-logo/  ui-footer/
        │   └── … (ui-accordion, ui-avatar, ui-toast, ui-skeleton, ui-log-viewer, …)
        │
        ├── layouts/
        │   ├── app-layout/                    # sidebar + topbar + <router-outlet>; tema y logout
        │   └── editor-layout/                 # orquestador del editor (ver §6)
        │
        └── features/
            ├── auth/
            │   ├── pages/login/  pages/register/
            │   └── components/auth-illustration/  components/google-auth-button/
            ├── projects/
            │   ├── pages/project-list/
            │   ├── components/project-table/  project-table-row/  project-action-menu/
            │   ├── data-access/project.service.ts
            │   └── models/project.interface.ts
            ├── collaboration/
            │   ├── pages/invitation-accept/              # pantalla del enlace del correo
            │   ├── components/invitation-form/  invitation-list/   # tontos
            │   ├── data-access/invitation.service.ts
            │   └── models/invitation.interface.ts
            ├── editor/
            │   ├── components/editor-toolbar/  editor-sidebar/  editor-side-panel/
            │   │              editor-workspace/  editor-visual-document/
            │   │              editor-pdf-preview/  editor-comments-view/
            │   ├── data-access/project-file.service.ts  project-compilation.service.ts
            │   └── models/project-file.interface.ts  editor-comment.interface.ts
            │              editor-sidebar-option.type.ts
            └── system/pages/coming-soon/      # placeholder para rutas sin implementar
```

### Responsabilidad de cada capa

| Carpeta | Contiene | Reglas |
|---|---|---|
| `core/` | Servicios `providedIn: 'root'`, guards, constantes | Sin UI. Nadie fuera de `core/` define URLs de API |
| `shared/components/` | Componentes `ui-*` **tontos** | Solo `input()`/`output()`. **Prohibido** inyectar servicios de datos o conocer el dominio |
| `layouts/` | Estructura visual + **orquestación** | Son los "contenedores inteligentes": inyectan servicios, mantienen el estado y lo bajan por inputs |
| `features/<dominio>/` | `pages/`, `components/`, `data-access/`, `models/` | Una feature no importa de otra feature salvo por `data-access` y `models` (p. ej. el editor usa `projects/data-access`) |

Ausencias deliberadas (no las "arregles" sin pedirlo): no hay `interceptors`,
ni `pipes`, ni `directives`, ni `*.routes.ts` por feature, ni lazy loading.

---

## 3. Convenciones obligatorias

Son las que ya sigue el código. Un cambio que las rompa está mal, aunque compile.

### Nombres de archivo y clase
Angular 22 moderno: **sin sufijo `.component`** en el nombre del archivo.

```
features/projects/pages/project-list/
├── project-list.ts     → export class ProjectListComponent
├── project-list.html
└── project-list.css
```

- Selector: `app-<kebab>` (`app-project-list`, `app-ui-button`, `app-editor-workspace`).
- Clase: `PascalCase` + sufijo `Component`.
- `templateUrl` + `styleUrl` (singular) siempre externos: **nada de plantillas
  o estilos inline**. Algunos `ui-*` triviales omiten el `.css` (p. ej. `ui-button`).
- Modelos: `<nombre>.interface.ts`, tipos sueltos: `<nombre>.type.ts`.
- Servicios: `<nombre>.service.ts`.

### Componentes

```ts
@Component({
  selector: 'app-project-table',
  standalone: true,
  imports: [ProjectTableRowComponent, UiEmptyStateComponent],
  templateUrl: './project-table.html',
  styleUrl: './project-table.css',
})
export class ProjectTableComponent {
  readonly projects = input.required<Project[]>();
  readonly actionSelected = output<{ project: Project; action: ProjectAction }>();
  readonly sortKey = signal<SortKey | null>(null);
  readonly sortedProjects = computed(() => /* … */);
}
```

- `standalone: true` explícito y `imports` con las dependencias exactas
  (incluidos los iconos de Lucide, que se importan individualmente).
- **Todo miembro reactivo es `readonly`**: inputs, outputs, signals y computed.
- Inputs con `input()` / `input.required()`; outputs con `output()`;
  two-way con `model()` (ver `ui-modal`).
- Dependencias con `inject()` en campos `private readonly`, no por constructor.
- Derivaciones con `computed()`, nunca getters que recalculen en cada render.
- `effect()` solo para sincronizar con el exterior (ver `editor-workspace`).
- API imperativa del DOM: `@ViewChild` + `ElementRef`; eventos globales con
  `@HostListener('document:keydown')`.

### Plantillas
Control flow nuevo de Angular, **nunca** `*ngIf` / `*ngFor` / `NgClass`:

```html
@if (projects().length) {
  @for (project of sortedProjects(); track project.id) { … }
} @else {
  <app-ui-empty-state title="No encontramos proyectos" … />
}
```

- Siempre invocar las signals: `projects()`, `canEdit()`.
- `track` obligatorio en `@for` (normalmente `project.id`).
- Accesibilidad: `aria-label`, `aria-sort`, `type="button"` en botones no-submit.
  Ya está así en `project-table.html`; mantenerlo.

### Estado
El estado vive en el **contenedor** (una `page` o un `layout`) y baja por inputs;
los hijos emiten outputs y **no mutan nada**. Patrón de actualización:

```ts
this.projects.update((projects) => [this.toProject(created), ...projects]);
```

Nunca mutar arrays u objetos en sitio: siempre nuevas referencias.

### Acceso a datos
Cada feature tiene su servicio en `data-access/` (`project.service.ts`,
`project-file.service.ts`, `invitation.service.ts`), que inyecta el `ApiClient`
compartido (`core/http/api-client.ts`) en vez de repetir su propio
`request<T>()` — eso ya no se duplica, es **un sitio**, y es ahí donde vive el
cifrado (ver §5b):

```ts
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api = inject(ApiClient);

  async getProject(id: string): Promise<ProjectResponse> {
    return this.api.request<ProjectResponse>(API_ROUTES.projects.byId(id));
  }
}
```

Reglas no negociables:

- `credentials: 'include'` en **toda** petición: la sesión es una cookie HttpOnly.
- URLs **solo** desde `API_ROUTES` (`core/constants/api.constants.ts`), que usa
  funciones con `encodeURIComponent` para los ids. No concatenar rutas a mano.
- Los errores del backend (`{ error }` o `{ title }`) se convierten en `Error`
  con `.status` (`ApiError`); el componente los captura y los pone en una
  signal `errorMessage` para mostrarlos.
- `Promise`, no `Observable`. No introducir `HttpClient` ni RxJS.
- Respuestas binarias con su propio método (`ProjectCompilationService.compile`
  recibe `{ pdf: "<base64>" }` ya descifrado por `ApiClient` y construye el
  `Blob` a partir de los bytes decodificados).

### Tipos del contrato con el backend
`models/` espeja el JSON del backend y, cuando hace falta, define el modelo de
vista aparte. En `projects`:

- `ProjectResponse` = lo que llega del backend (`name`, `ownerName`, `role`,
  `isArchived`, fechas ISO).
- `Project` = modelo de UI (`title`, `ownerInitials`, `updatedAt` ya formateado,
  `updatedAtTimestamp` para ordenar).
- La conversión vive en el componente (`toProject()` en `project-list.ts`).

Los enums del backend llegan como **strings en mayúsculas** y se tipan como
uniones literales: `'OWNER' | 'EDITOR' | 'VIEWER'`, `'FILE' | 'FOLDER'`.

### Estilos y tema
- `src/styles.css` define los **tokens semánticos** en `:root` y `:root.app-dark`
  (`--surface-card`, `--surface-border`, `--text-color`, `--primary-color`, …).
- Las features **deben** usar esos tokens, no colores literales ni variables
  internas de PrimeNG, para no romper el contraste en modo oscuro.
- El modo oscuro es la clase `.app-dark` en `<html>`, que pone `ThemeService` y
  que `providePrimeNG` tiene configurada como `darkModeSelector`.
- Cada componente lleva su `.css` propio (encapsulado). Tailwind está disponible
  para utilidades en las plantillas.
- Presupuesto de build en producción: **4 kB de advertencia y 8 kB de error por
  hoja de estilos de componente**; 500 kB / 1 MB para el bundle inicial.

---

## 4. Rutas

Todas en `src/app/app.routes.ts`, eager:

| Ruta | Componente | Guard |
|---|---|---|
| `''` | `RegisterComponent` | — |
| `login` | `LoginComponent` | — |
| `editor/:projectId` | `EditorLayoutComponent` | `authGuard` |
| `invitations/:token` | `InvitationAcceptComponent` | `authGuard` |
| `projects` | `AppLayoutComponent` (con hijos) | `authGuard` |
| `projects` → `''` | `ProjectListComponent`, `data: { projectView: 'all' }` | heredado |
| `projects/my-projects` | `ProjectListComponent`, `projectView: 'mine'` | heredado |
| `projects/shared` | `ProjectListComponent`, `projectView: 'shared'` | heredado |
| `projects/archived` | `ProjectListComponent`, `projectView: 'archived'` | heredado |
| `projects/templates`, `/trash`, `/settings` | `ComingSoonComponent` con `data: { title, description }` | heredado |

Patrones a respetar:

- Una misma página se reutiliza para varias vistas mediante `route.snapshot.data`
  (`projectView`) en lugar de duplicar componentes.
- Las rutas aún no implementadas apuntan a `ComingSoonComponent` con su
  `title`/`description` en `data`.

---

## 5. Autenticación en el cliente

- No hay formularios de contraseña funcionales: el login real es **Google OAuth**
  mediante navegación del navegador a `GET /api/auth/login`
  (`google-auth-button`), que acaba redirigiendo a `/projects`.
- La sesión es la cookie HttpOnly del backend. **El frontend no guarda tokens**
  ni en `localStorage` ni en `sessionStorage`.
- `authGuard` (`core/auth/auth.guard.ts`) hace `fetch('/api/auth/me')` y
  redirige a `/login` con `router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })`
  si falla, para volver a la misma URL tras autenticarse (clave para el enlace
  de invitación por correo, que llega sin sesión). En servidor
  (`!isPlatformBrowser`) devuelve `true`: la protección real ocurre tras la
  hidratación.
- `google-auth-button` recibe `returnUrl` como `input()` y lo añade codificado
  a `GET /api/auth/login?returnUrl=...`. El backend valida que sea una ruta
  relativa (`IsSafeReturnUrl`); cualquier otra cosa cae a `/projects`.
- `AuthService` cachea el usuario en una signal; `loadCurrentUser()` es
  idempotente (sale si ya hay usuario) y solo corre en navegador.
  `logout()` vive en `app-layout`: limpia la signal, hace `POST /auth/logout` y
  navega a `/login` **aunque la petición falle**.
- Todo código que toque `window`, `document` o `URL.createObjectURL` debe
  comprobar `isPlatformBrowser(this.platformId)` o estar en un hook de navegador,
  porque el andamiaje SSR/prerender existe.

---

## 5b. Cifrado en el cliente

Todo el tráfico de datos (todo salvo `/auth/*` y `/crypto/session`) viaja
cifrado con AES-256-GCM: `ApiClient` envuelve el cuerpo saliente con
`CryptoTransport.wrap` y desenvuelve toda respuesta con `unwrap`, usando la
clave de sesión (`K_session`) que entrega el backend.

- `SessionKeyService` pide `GET /crypto/session` (autenticado) y **guarda la
  clave solo en memoria**, en una signal — **nunca** en `localStorage` ni
  `sessionStorage`: ahí sobreviviría al cierre de la pestaña y sería legible
  por cualquier script de la página. La clave se importa con
  `extractable: false`, así que tampoco se puede volver a serializar desde
  JavaScript una vez cargada.
- `AppLayoutComponent` la carga junto con `loadCurrentUser()` en el
  constructor y la limpia (`sessionKey.clear()`) en `logout()`.
- Si el usuario vuelve a entrar con la misma cuenta en otra pestaña, la clave
  de sesión rota en el backend y la copia en memoria de la pestaña vieja queda
  obsoleta: todas sus peticiones responderían `400`. `ApiClient` detecta ese
  `400` en claro (el que genera el middleware, no un error de negocio),
  vuelve a pedir la clave una vez y reintenta — sin esto, la pestaña vieja se
  queda rota sin explicación.
- `crypto.subtle` solo existe en navegador y bajo contexto seguro: todo el
  código que lo toca va detrás de `isPlatformBrowser`, igual que el resto del
  proyecto.
- El `ICipherRegistry`/`cipherRegistry` espeja al del backend: cifra siempre
  con el algoritmo actual y descifra con el que el sobre indique, que es lo
  que permite sustituir el algoritmo sin romper nada ya cifrado.

---

## 6. El editor (caso de referencia de arquitectura)

`EditorLayoutComponent` es el mejor ejemplo del patrón contenedor/presentacional
y la pieza a imitar.

**Composición visual**

```
editor-toolbar          (barra superior: compilar, guardar, estado)
editor-sidebar          (iconos: files | search | comments)
editor-side-panel       (árbol de archivos, búsqueda o comentarios)
ui-split-pane
 ├── editor-workspace   (pestañas + textarea de código / vista visual)
 └── editor-pdf-preview (iframe del Blob del PDF)
```

**Estado en el layout** — todo en signals: `project`, `projectFiles`,
`activeEditorFile`, `pdfUrl`, `pdfStatus`, `pdfError`, `savedFileId`,
`saveVersion`, `comments`, `loadError`, y el permiso derivado:

```ts
readonly canEdit = computed(() => {
  const project = this.project();
  return !!project && !project.isArchived && (project.role === 'OWNER' || project.role === 'EDITOR');
});
```

`canEdit` se pasa a los hijos y estos deshabilitan la edición. **Es solo UX: la
autorización real la hace el backend.** Nunca asumas que ocultar un botón protege
un recurso.

**Flujos clave**

- *Carga*: `Promise.all([getProject, getFiles])`, se abre `main.md` (o el primer
  archivo) y se compila si existe `main.md` en la raíz; si no, `pdfStatus = 'error'`
  con mensaje explicativo.
- *Guardar* (`Ctrl/Cmd+S`): `editor-workspace` emite `contentSaved`; el layout
  llama a `saveContent()`, incrementa `saveVersion` (lo que limpia el flag `dirty`
  de la pestaña vía `effect`) y, **si el archivo guardado es `main.md` de la raíz,
  recompila automáticamente**.
- *Compilar*: se crea un `objectURL` del `Blob` nuevo y se revoca el anterior.
  `ngOnDestroy` revoca el último. Mantener esta disciplina al tocar el PDF.
- *Borrar carpeta*: el layout calcula en cliente el cierre transitivo de
  descendientes por `parentId` y los quita del estado.
- *Atajos*: definidos en `core/shortcuts/keyboard-shortcuts.ts`
  (`SAVE_DOCUMENT`, `FIND`, `REPLACE`, `UNDO`, `REDO`, `RECOMPILE`) y resueltos
  con `KeyboardShortcutService.matches(event, 'SAVE_DOCUMENT')`, que ya maneja
  `ctrl`/`meta`. **No compares `event.key` a mano**: añade la entrada al mapa.

El árbol llega plano del backend; `editor-side-panel.flatEntries` lo aplana con
`depth` para renderizar la indentación.

---

## 7. Ejecución

```bash
pnpm install
pnpm start          # ng serve en 0.0.0.0:4200 con proxy /api -> localhost:5282
pnpm build          # ng build (configuración production por defecto) -> dist/
pnpm test           # Vitest
```

Requisitos de entorno:

- El backend debe estar en `http://localhost:5282` (`proxy.conf.json` reescribe
  `^/api` a `''`, por eso las rutas del backend **no** llevan prefijo `api/`).
- `public/runtime-config.js`: copiar de `runtime-config.example.js` y poner la
  licencia de PrimeUI. **No versionarlo.** Sin él, `providePrimeNG` recibe
  `license: undefined`.
- `devenv.nix` en la raíz provee `nodejs` y `pnpm`, y añade
  `frontend/node_modules/.bin` al `PATH` (por eso `ng` funciona directo).

Formateo: Prettier con `printWidth: 100`, comillas simples y parser `angular`
para `.html`.

---

## 8. Cómo agregar una funcionalidad

1. **Modelo** — `features/<dominio>/models/<x>.interface.ts`. Si el backend
   devuelve una forma distinta a la que la UI necesita, define las dos
   (`XResponse` y `X`) y convierte en el componente.
2. **Ruta de API** — añade la entrada en `API_ROUTES`
   (`core/constants/api.constants.ts`), con función y `encodeURIComponent` si
   lleva ids.
3. **Data access** — `features/<dominio>/data-access/<x>.service.ts`,
   `@Injectable({ providedIn: 'root' })`, métodos `async` que devuelven promesas
   y el helper `request<T>()` privado del patrón.
4. **UI genérica** — si necesitas un control reutilizable, va en
   `shared/components/ui-<x>/` y **solo** con `input()`/`output()`.
5. **UI de dominio** — componentes en `features/<dominio>/components/` (tontos,
   reciben datos) y el contenedor en `pages/` o en un `layout` (inyecta
   servicios, mantiene signals, maneja errores).
6. **Ruta** — regístrala en `app.routes.ts` con `authGuard` si requiere sesión;
   usa `data` para parametrizar una página reutilizada.

Checklist antes de dar algo por terminado:

- [ ] `standalone: true`, `imports` exactos, plantilla y estilos en archivos aparte.
- [ ] Miembros reactivos `readonly`; `input()`/`output()`/`signal()`/`computed()`.
- [ ] `@if` / `@for` con `track`; signals invocadas en la plantilla.
- [ ] `fetch` con `credentials: 'include'` y URL desde `API_ROUTES`.
- [ ] Errores capturados y expuestos en una signal para la UI.
- [ ] Colores vía tokens de `styles.css`; verificado en claro **y** oscuro.
- [ ] CSS del componente por debajo de 4 kB.
- [ ] Nada de `window`/`document` sin `isPlatformBrowser`.
- [ ] Atajos de teclado añadidos a `KEYBOARD_SHORTCUTS`.
- [ ] `pnpm build` sin errores de presupuesto.

---

## 9. Pendientes (ver `TODO.md` en la raíz)

Listo: editor Markdown → PDF, compilación automática al guardar, CRUD de
proyectos, árbol de archivos, guardado persistente, atajos globales, feature
**`collaboration`** (invitar, listar, revocar y reenviar desde "Compartir
proyecto"; pantalla de aceptación en `/invitations/:token`), y el cifrado del
tráfico de datos con `K_session` (ver §5b).

Por hacer en el frontend:

- **Edición en tiempo real**: hoy `saveContent` es un `PUT` del contenido
  completo del archivo. Necesitará un canal push (SignalR/WebSocket) y
  resolución de conflictos; `editor-workspace` mantiene el contenido en
  `fileContents` (un `Record<fileId, string>`), que es el punto de integración.
- Los **comentarios** de `editor-comments-view` son estado local en memoria con
  autor fijo (`'Diego'`) y se pierden al recargar: falta backend.
- `ComingSoonComponent` cubre Plantillas, Papelera y Configuración.
- Pendiente de la lista general: control de cambios y export/import ZIP.
