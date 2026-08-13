# PROYECTO DE SEGURIDAD

Hacer un clon de Overleaf. Dbe tener las funcionalidades principales

## REQUERIMIENTOS FUNCIONALES

- Debe tener un editor de un DSL, similar a Latex con capacidades de mostrar imagenes, ecuaciones, etc; y que se vea el PDF al lado
- Debe poder recompilar el PDF automaticamente al guardar el documento
- Autocompletado y verificacion de sintaxis de Latex
- CRUD de proyectos
- Colaboracion simultanea sobre un mismo proyecto
- Control de cambios
- Agregar e invitar a usuarios a un proyecto
- Arbol de archivos 
- Funcion de copiar un proyecto
- Funcion de exportar un proyecto como ZIP
- Funcion de importar un ZIP
- Funcion de de exportar el proyecto como PDF

## FLUJO DE ENCRIPTACION

Frontend ----Encriptado----> Backend --NO USAR ADMIN PARA TODO--> DB (Data encriptada)----> Backend --Encriptado--> Frontend --Desencripta--> Usuario (ve las cosas normalmente)