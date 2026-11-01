-- Se ejecuta UNA SOLA VEZ, a mano, como superusuario de PostgreSQL.
-- Migrate() corre con el rol de la aplicación (overleaf_app) y ese rol no
-- puede crear extensiones ni roles: por eso este paso no es parte de una
-- migración de EF Core. Ver backend/README.md, sección "Flujo de encriptación".

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE ROLE overleaf_app LOGIN PASSWORD 'PSeguridad_999+556';

GRANT CONNECT ON DATABASE pseguridad TO overleaf_app;
GRANT USAGE ON SCHEMA public TO overleaf_app;
