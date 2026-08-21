# PROYECTO DE SEGURIDAD

Hacer un clon de Overleaf. Dbe tener las funcionalidades principales

## REQUERIMIENTOS FUNCIONALES

- Editor de Markdown a PDF
- Debe poder recompilar el PDF automaticamente al guardar el documento
- CRUD de proyectos
- Colaboracion simultanea sobre un mismo proyecto
- Control de cambios basico (quien hizo el cmabio, cuando hizo el cambio) 
- Agregar e invitar a usuarios a un proyecto
- Arbol de archivos 
- Funcion de copiar un proyecto
- Funcion de exportar un proyecto como ZIP
- Funcion de importar un ZIP
- Funcion de de exportar el proyecto como PDF

## FLUJO DE ENCRIPTACION

Frontend ----Encriptado----> Backend --NO USAR ADMIN PARA TODO--> DB (Data encriptada)----> Backend --Encriptado--> Frontend --Desencripta--> Usuario (ve las cosas normalmente)