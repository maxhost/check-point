# UI del onboarding del backoffice

Estado: implementado en su primera version el 2026-09-20.

## Objetivo

El onboarding posterior al wizard es una zona de activacion, no otra tarjeta operativa del
dashboard. Tiene que conservar jerarquia cuando pase de un paso a cinco, funcionar primero en
movil y desaparecer cuando el checklist quede completo.

La fuente de verdad es `GET /api/onboarding/checklist`. La UI no reordena, no inventa `done` y
no recibe selectores por HTTP. Los pasos de cada tour viven en su pantalla y se ejecutan con
`driver.js`.

## Patron elegido: checklist progresivo

1. Es un widget persistente fuera del flujo del dashboard. En movil queda anclado sobre la
   navegacion inferior; en escritorio flota abajo a la derecha. Expandido funciona como un panel
   de tareas que nace desde esa misma posicion. Vive en el layout del backoffice para seguir
   disponible al navegar entre pantallas, y solo se monta para el owner.
2. El header permite colapsarlo a una franja compacta `N de M · Continuar configuracion` sin
   perder el punto de retorno.
3. Cada fila representa una sola tarea. Solo la siguiente accion disponible recibe el CTA
   principal; las completadas, bloqueadas y todavia no publicadas tienen estados distintos.
4. Un `required: true` pendiente bloquea visualmente los items de mayor `position`, igual que
   el API bloquea su escritura. Los opcionales no bloquean a los siguientes.
5. Un tour que todavia no tiene pantalla/pasos se lista como `Proximamente` y no se puede
   iniciar. Cuando exista, su pantalla registra el `anchor` local y llama
   `startOnboardingTour({ tourId, steps })`.
6. Al quedar todos los items en `done: true`, el bloque desaparece. Los tours completados se
   podran volver a ofrecer desde ayuda contextual, no desde un onboarding eternamente visible.
7. Un error del checklist se muestra con reintento; nunca se interpreta como «no hay nada que
   hacer».

## Estados de una fila

| Estado | Representacion | Interaccion |
|---|---|---|
| completado | check + texto atenuado | ninguna |
| actual | numero resaltado + descripcion | CTA principal |
| bloqueado | candado + requisito | ninguna |
| proximamente | reloj + disponibilidad | ninguna |
| error | mensaje accionable | reintentar |

## Mobile first

- Lista vertical: no se usa un stepper horizontal que fuerce truncado o scroll lateral.
- Targets interactivos de al menos 44 px y CTA de ancho completo en pantallas angostas.
- La copia secundaria se mantiene junto al paso; el usuario no debe memorizar instrucciones
  antes de navegar.
- El widget se ubica por encima de la barra inferior, sin tapar el acceso central al mostrador.
  Su lista tiene altura maxima y scroll propio para no desbordar la pantalla.
- Cada tarea usa dos filas en todos los tamaños del widget: arriba `[indicador][contenido]` y
  abajo `[CTA a ancho completo]`. El boton nunca participa como tercera columna, nunca ensancha
  la columna del numero y nunca comprime la copia.
- La version colapsada conserva progreso y una etiqueta explicita; no depende solo de color o
  de un icono.

## Fundamento externo

- Appcues recomienda checklists cortos de 3–5 acciones, una tarea por item, progreso visible y
  un acceso persistente mientras esten incompletos:
  <https://www.appcues.com/blog/essential-guide-mobile-user-onboarding-ui-ux> y
  <https://appcues.helpjuice.com/en_US/checklists/create-a-checklist>.
- Nielsen Norman Group recomienda progressive disclosure en movil y ayuda contextual visible
  sin imponer todo el detalle de una vez:
  <https://www.nngroup.com/articles/progressive-disclosure/> y
  <https://www.nngroup.com/articles/onboarding-tutorials/>.
- Carbon recomienda orientacion vertical cuando sea posible y estados explicitos de completado,
  actual, pendiente, bloqueado y error para procesos de tres o mas pasos:
  <https://carbondesignsystem.com/components/progress-indicator/usage/>.
- Los tours instructivos deben ser breves, opcionales y limitarse a lo minimo necesario:
  <https://www.nngroup.com/articles/mobile-app-onboarding/>.

## Extension de un tour

Para publicar un tour nuevo hacen falta las tres piezas, juntas:

1. La pantalla y sus elementos con selectores locales estables.
2. Sus `DriveStep[]` junto a esa pantalla.
3. El mapeo del `anchor` del checklist a la accion que navega/inicia el tour.

Terminar guarda `completed`; cerrar guarda `skipped`. Ninguna de esas decisiones se delega a
`driver.js` ni se manda como pasos JSON desde el servidor.
