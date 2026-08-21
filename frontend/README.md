# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Estructura
src/app/
├─ core/                                  # Global; se carga una vez
│  ├─ auth/
│  │  ├─ auth.service.ts
│  │  ├─ auth.guard.ts
│  │  └─ auth.interceptor.ts
│  ├─ services/
│  │  ├─ theme.service.ts
│  │  ├─ notification.service.ts
│  │  └─ storage.service.ts
│  ├─ models/
│  │  ├─ api-response.interface.ts
│  │  ├─ pagination.interface.ts
│  │  ├─ http-error.interface.ts
│  │  └─ user-session.interface.ts
│  └─ constants/
│     └─ app.constants.ts
│
├─ shared/                                # Reutilizable y sin lógica de negocio
│  ├─ components/
│  │  ├─ ui-button/
│  │  ├─ ui-modal/
│  │  ├─ ui-table/
│  │  ├─ ui-tabs/
│  │  ├─ ui-file-tree/
│  │  ├─ ui-split-pane/
│  │  ├─ ui-loading/
│  │  └─ ...
│  ├─ directives/
│  ├─ pipes/
│  ├─ utils/
│  └─ validators/
│
├─ layouts/                               # Estructuras comunes de pantalla
│  ├─ auth-layout/
│  │  ├─ auth-layout.ts
│  │  ├─ auth-layout.html
│  │  └─ auth-layout.css
│  ├─ app-layout/
│  │  ├─ app-layout.ts                    # Sidebar + topbar
│  │  ├─ app-layout.html
│  │  └─ app-layout.css
│  └─ editor-layout/
│     ├─ editor-layout.ts                 # Explorer + editor + PDF preview
│     ├─ editor-layout.html
│     └─ editor-layout.css
│
├─ features/
│  ├─ auth/
│  │  ├─ pages/
│  │  │  ├─ login/
│  │  │  ├─ register/
│  │  │  ├─ forgot-password/
│  │  │  └─ reset-password/
│  │  ├─ components/
│  │  │  └─ password-strength/
│  │  ├─ data-access/
│  │  │  └─ auth-api.service.ts
│  │  ├─ models/
│  │  │  ├─ login-request.interface.ts
│  │  │  ├─ register-request.interface.ts
│  │  │  └─ auth-user.interface.ts
│  │  └─ auth.routes.ts
│  │
│  ├─ projects/
│  │  ├─ pages/
│  │  │  ├─ project-list/
│  │  │  ├─ project-create/
│  │  │  ├─ project-templates/
│  │  │  └─ project-trash/
│  │  ├─ components/
│  │  │  ├─ project-filter-bar/
│  │  │  ├─ project-list-item/
│  │  │  └─ project-member-list/
│  │  ├─ data-access/
│  │  │  └─ projects-api.service.ts
│  │  ├─ models/
│  │  │  ├─ project.interface.ts
│  │  │  ├─ project-template.interface.ts
│  │  │  ├─ project-status.enum.ts
│  │  │  └─ project-filter.interface.ts
│  │  └─ projects.routes.ts
│  │
│  ├─ editor/
│  │  ├─ pages/
│  │  │  └─ editor/
│  │  ├─ components/
│  │  │  ├─ editor-file-explorer/
│  │  │  ├─ editor-toolbar/
│  │  │  ├─ editor-preview/
│  │  │  └─ editor-compilation-panel/
│  │  ├─ data-access/
│  │  │  ├─ editor-api.service.ts
│  │  │  └─ compilation-api.service.ts
│  │  ├─ models/
│  │  │  ├─ editor-tab.interface.ts
│  │  │  ├─ file-node.interface.ts
│  │  │  ├─ compilation-result.interface.ts
│  │  │  └─ compilation-error.interface.ts
│  │  └─ editor.routes.ts
│  │
│  ├─ collaboration/
│  │  ├─ pages/
│  │  │  ├─ members/
│  │  │  └─ comments/
│  │  ├─ components/
│  │  │  ├─ collaborator-list/
│  │  │  ├─ invitation-form/
│  │  │  └─ comment-sidebar/
│  │  ├─ data-access/
│  │  │  └─ collaboration-api.service.ts
│  │  ├─ models/
│  │  │  ├─ collaborator.interface.ts
│  │  │  ├─ invitation.interface.ts
│  │  │  ├─ comment.interface.ts
│  │  │  └─ permission.enum.ts
│  │  └─ collaboration.routes.ts
│  │
│  ├─ settings/
│  │  ├─ pages/
│  │  │  ├─ profile-settings/
│  │  │  ├─ editor-settings/
│  │  │  └─ account-settings/
│  │  ├─ components/
│  │  │  ├─ profile-form/
│  │  │  └─ danger-zone/
│  │  ├─ data-access/
│  │  │  └─ settings-api.service.ts
│  │  ├─ models/
│  │  │  └─ user-preferences.interface.ts
│  │  └─ settings.routes.ts
│  │
│  └─ activity/
│     ├─ pages/
│     │  └─ activity-history/
│     ├─ components/
│     │  └─ activity-filter/
│     ├─ data-access/
│     │  └─ activity-api.service.ts
│     ├─ models/
│     │  └─ activity.interface.ts
│     └─ activity.routes.ts
│
├─ app.config.ts
├─ app.routes.ts
├─ app.ts
├─ app.html
└─ app.css
