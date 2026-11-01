# COSAS CONCRETAS QUE FALTAN POR HACER

El proyecto esta avanzado. Se necesitan nuevas funcionalidades.

## FUNCIONALIDADES LISTAS

- Editor de Markdown a PDF
- Compilacion automatica de PDF
- CRUD de proyectos
- Se deben poder enviar invitaciones a otros usuarios para participar en un proyecto de otra persona
- Las invitaciones se envian por correo electronico
- Solo las personas invitadas pueden ver el proyecto
- Se puede invitar para editar o para ver. Nada mas
- Tras aceptar una invitacion el usuario tiene acceso al proyecto en particular

## COSAS VIEJAS POR HACER

- Cuando el usuario haga "Ctrl+S", para guardar, tambien ve los cambios que han hecho los otros participantes
- Se debe poder tener una auditoria de cambios (quien hizo, que hizo y cuando hizo)
- Se debe poder copiar un proyecto
- Se debe poder exportar un proyecto como ZIP
- Se debe poder importar un proyecto como ZIP

## EN QUE CENTRARSE AHORA

- Flujo de encriptacion: Se debe poder hacer el flujo de encriptacion especificado
- Debe tener arquitectura limpia, de modo que pueda cambiar el algoritmo de encriptacion por otro que vaya a crear, eventualmente
- Debe haber encriptacion y desencriptacion en: frontend, backend y base de datos
- El flujo en cuestion consiste en:
1. El frontend debe poder enviar los datos encriptados al backend
1. El backed recibe los datos encriptados del frontend, desencripta, procesa y envia datos a la base
1. La base recibe los datos y los encripta para almacenarlos
1. Cuando el backend pide datos a la base, esta da datos encriptados
1. El backend desencripta los datos, procesa, y envia datos encriptados al frontend
1. El frontend recibe los datos encriptados del backend, procesa y muestra los datos al usuario
- Se debe proponer un flujo para esta encriptacion
- Se pueden definir stored_procedures, o algo similar, para hacer las operaciones de la base
