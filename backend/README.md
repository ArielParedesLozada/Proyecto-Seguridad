# BACKEND

Backend del proyecto de Seguridad

## ESTRUCTURA DEL PROYECTO

```text
backend/
├── Program.cs: Entrypoint de la aplicacion. Obtiene variables de entorno, registra servicios, etc.
├── App: Capa de la aplicacion. Aqui se maneja la logica de la aplicacion realmente.
    ├── Auth: Servicios de autenticacion
    ├── Projects: Servicios de los proyectos
    ├── Dtos: Data transfer objects en la capa de aplicacion
    └── ...
├── Assets:
├── Config: Configuracion de la app. Se registran los servicos de la capa de aplicacion, y toda la configuracion que se requiera registar
├── Data: Capa de datos de la app.
    ├── Database/Appdatabase.cs: Definicion de la base de datos. Registra las entidades, nombres y las definiciones de las tablas
    ├── Migrations: Migraciones de la base de datos, generadas con EF Core
    └── Seed: Seeders de la Db. Placeholder, por el momento
├── Domain: Capa de dominio de la app
    ├── Enums
    └── Models: Entidades de la app
├── Infrastructure: Capa de infrastructura. Si no sabes donde va algo, probablemente vaya aqui
└── Presentation: Capa de presentacion. Como es una API Web, esta capa es la encargada del trafico web, enfocada en las rutas, requests y responses en JSON
    ├── Controllers: Controladores de la app. Define controladores, rutas y hace uso de los servicios definidos en App/
    ├── Dtos: Data transfer objects
        ├── Requests
        └── Responses
    └── Middleware: Middleware de la aplicacion
 
```

