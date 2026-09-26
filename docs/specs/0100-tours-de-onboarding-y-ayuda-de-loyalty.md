---
spec: 0100
fecha: 2026-09-26
estado: borrador
resumen: Tour general de Loyalty y cuatro ayudas para crear, editar, programar cierre y editar políticas, reutilizando el editor y el progreso de onboarding existentes.
disjunta: no
archivos: apps/merchant/src/app/backoffice/loyalty/, apps/merchant/src/app/backoffice/onboarding/onboarding-view.ts, tests/e2e/loyalty-*.spec.ts
---

# 0100 — Tours de onboarding y ayuda de Loyalty

**Planificación retomada por owner el 2026-09-26**, tras los ajustes del formulario.
Borrador preparado para aprobación y handoff antes del clear; no iniciar código aún.

Propuesta de planificación, sin implementación. Consume
[ADR 0090](../adr/0090-los-tours-de-loyalty-acompanan-el-editor-existente.md).
El owner definió un recorrido general y cuatro ayudas. Las entradas, pasos y conducta
siguientes son una propuesta para aprobar; no se atribuyen al owner como decisiones.

## Evidencia actual

- `onboarding/onboarding-api.ts` y `server/onboarding/tours.ts`: `program` ya es un id
  válido; `onboarding-view.ts` aún no lo incluye en el mapa de destinos disponibles.
- `loyalty/loyalty-page.tsx`: GET inicial, consulta/editor/cierre y confirmaciones; no
  controller ni entrada Ayuda. Con programa vacío se monta el editor de creación.
- `program-form-state.ts`: creación agrega Modalidad; Puntos usa Unidades → Términos
  → Premios → Revisión; Sellos usa Sello y objetivo → Diseño → Términos → Premios
  → Revisión. La edición conserva modalidad y omite Modalidad.
- `steps/step-terms.tsx`: plantillas, texto y acumulación comparten el paso Términos.
  `insertTemplate` añade texto al borrador; no reemplaza los términos ni guarda.
- `use-loyalty-program.ts`: escritura completa, GET posterior, resultado incierto y
  refresh fallido; el tour debe observarlos, conservando su protección de escrituras.
- Producción no fue inspeccionada con sesión: la herramienta web no abre la URL.

## Alcance

Entra: orientación general, diálogo Ayuda, cuatro recorridos operativos, conexión al
checklist, anchors/callbacks y accesibilidad. No entra: backend, schema, nuevos tipos de
políticas, cambio de reglas del programa, creación de datos de ejemplo ni automatizar
guardado/cierre. Cancelar cierre conserva su UI; no se añade una quinta ayuda en esta
entrega. Definir esa guía requeriría ampliar el alcance.

## Entrada, progreso y permisos

- Ayuda junto a la cabecera, accesible también durante edición sin borrar campos.
  Diálogo con «Conocer fidelización» y las cuatro tareas, con disponibilidad y motivo.
- Checklist owner → `/backoffice/loyalty?tour=onboarding`, constante compartida entre
  destino/parser. Consumir sólo ese parámetro después de GET válido y anchors montados;
  conservar otros parámetros. No relanzar al recargar ni por desmontaje/remontaje.
- Sólo la orientación iniciada desde onboarding owner registra
  `POST /api/onboarding/tours/program` con completed/skipped, por negocio. Completar
  el tour no significa crear ni editar un programa. Repetir orientación y ayudas usa
  `persist: false`, también para staff autorizado.
- Listo registra completed; Saltar/cierre voluntario registra skipped. Desmontaje,
  pérdida de acceso o limpieza técnica no registra una decisión del usuario.
- Checklist oculto durante recorrido y refrescado al terminar; fallo de progreso
  conserva aviso y reintento del mismo POST, sin inventar done ni repetir operaciones.
- Mantener SSR y permiso loyalty; catalog es independiente. No crear consultas de
  catálogo si falta permiso. Crear/editar/políticas owner o staff con loyalty; cierre
  sólo owner. Ninguna ayuda habilita acciones bloqueadas por API o estado.

## Orientación general: cinco pasos propuestos

| Paso | Con programa guardado | Sin programa |
| --- | --- | --- |
| 1. Tu programa | Tipo y estado: Sellos/Puntos, activo/en cierre | Selector de modalidad y qué ofrece cada opción |
| 2. Cómo se ganan beneficios | Meta/acumulación y reglas de canje | Indicador de pasos; explicar que allí se configurará meta/acumulación |
| 3. Qué reciben tus clientes | Premios y costo en puntos, si corresponde | Información centrada, sin anchor: los premios se configuran más adelante |
| 4. Términos y gestión | Términos; explicar edición y cierre sólo owner, o fechas si está en cierre | Información centrada, sin anchor: revisar términos y activar al final |
| 5. Ayuda cuando la necesites | Botón Ayuda y tareas disponibles | Botón Ayuda y guía Crear |

No avanzar el editor ni abrir formularios para fabricar anchors. Pasos informativos sin
elemento sólo cuando la sección aún no existe; nunca esperar un selector desmontado.
La variante con programa en cierre explica fechas/bloqueo de edición, sin mostrar
controles de propietario a staff. Siguiente/Anterior sólo recorren explicaciones.
Durante edición, incluso con programa guardado, usar la variante editor sin navegar:
primer paso ancla el contenido actual y explica el borrador; segundo ancla el progreso.
Si hay formulario de cierre/confirmación abierto, completar o salir de ese flujo antes
de abrir otra ayuda u orientación. Preparación, recorte, escritura y recuperación de
acceso bloquean inicio; conservar el estado y explicar el motivo en Ayuda.

## Copy y anchors definidos para implementación

Añadir `data-tour="loyalty-…"` al contenedor indicado; usar selectores locales estables,
sin depender del texto, número del paso ni posición de un premio. Cada spotlight debe
incluir los controles que pide operar. Los anchors siguientes son contratos nuevos a
implementar, no atributos ya presentes en el árbol.

| Anchor | Contenedor real previsto |
| --- | --- |
| `loyalty-help` | Botón Ayuda junto a ModuleHeader |
| `loyalty-program` | Encabezado/tipo/estado de ProgramView |
| `loyalty-rules` | Métrica y reglas de acumulación/canje en ProgramView |
| `loyalty-rewards-view` | Grupo de premios publicado |
| `loyalty-management`, `loyalty-terms-view`, `loyalty-closing-dates` | Footer de gestión, sección de términos y fechas de cierre, respectivamente; el paso general elige un anchor presente según estado |
| `loyalty-editor-progress` | ProgressIndicator del editor |
| `loyalty-editor-step` | Contenido del paso actual y navegación; genérico para orientación en borrador |
| `loyalty-modality`, `loyalty-units`, `loyalty-basics`, `loyalty-design` | Contenido y navegación de cada paso real |
| `loyalty-terms` | Plantillas, textarea y navegación; acumulación usa su propio anchor |
| `loyalty-accrual` | AccrualFields completo con sus controles/ayudas |
| `loyalty-rewards-edit` | Premios editables y botón Agregar, si corresponde |
| `loyalty-redemption-policy` | Configuración avanzada/checkbox/descripción y navegación |
| `loyalty-review` | Revisión completa y botón Activar/Guardar |
| `loyalty-edit-action`, `loyalty-close-action` | Botón de entrada respectivo |
| `loyalty-close-form` | Consecuencias, ambas fechas, zona horaria y Continuar |
| `loyalty-close-confirm` | Diálogo completo con Confirmar y Cancelar |
| `loyalty-result` | Consulta tras GET válido de la operación actual |
| `loyalty-refresh` | Aviso de escritura confirmada/GET fallido y Actualizar vista |

Copy de orientación (cinco pasos; Anterior/Siguiente/Listo, Saltar al inicio):

1. **Tu programa de fidelización.** Consulta: «Acá ves si tu programa es de sellos o
   puntos y si está activo o en cierre». Creación: «Elegí sellos para completar una
   tarjeta o puntos para asignar un costo a cada premio». Edición: «Estás trabajando
   en un borrador. Los cambios se aplican cuando revisás y guardás el programa».
2. **Cómo se ganan beneficios.** Consulta: «Revisá cómo acumulan tus clientes y qué
   objetivo deben alcanzar». Editor: «Este indicador muestra los pasos. Vas a definir
   cómo se acumulan los beneficios dentro del formulario».
3. **Qué reciben tus clientes.** Consulta: «Estos son tus premios. En un programa de
   puntos, cada premio muestra su costo». Editor, sin anchor: «Más adelante configurás
   los premios; podés usar un producto del catálogo, un premio libre o un descuento».
   Sin catalog: mencionar sólo premios libres/descuentos y conservación de productos
   guardados; no sugerir una operación sin permiso.
4. **Términos y gestión.** Consulta activa: «Acá consultás los términos y podés editar
   el programa»; owner añade «También podés programar su cierre». En cierre: «Estas
   fechas indican hasta cuándo se acumula y se canjea. Durante el cierre no se puede
   editar el programa» (anchor de cierre/fechas, sin controles inexistentes). Editor,
   sin anchor: «Revisá los términos y todos los cambios antes de activar o guardar».
5. **Ayuda cuando la necesites.** «Desde Ayuda podés volver a este recorrido o abrir
   una guía para crear, editar, programar el cierre o editar políticas, según el estado
   del programa y tus permisos».

Copy operativo por fase (el spotlight acompaña, nunca opera por el usuario):

| Fase | Mensaje principal |
| --- | --- |
| Modalidad | «Elegí Sellos o Puntos y pulsá Continuar para configurar tu programa». |
| Unidades | «Elegí cómo se llama una unidad y cómo se nombran varias». |
| Sello y objetivo | «Poné el nombre del sello y cuántos necesita el cliente para completar la tarjeta». |
| Diseño | «Personalizá la tarjeta. La imagen es opcional; si abrís el recorte, terminá o cancelá antes de continuar». |
| Términos | «Escribí tus términos. Las plantillas son opcionales y se añaden al texto actual». |
| Acumulación | «Definí cómo se ganan beneficios. Elegí valores válidos y pulsá Continuar». |
| Premios | «Elegí el premio; en Puntos, definí el costo de cada uno. Continuar conserva tu borrador». |
| Canje sin saldo | «Decidí si el mostrador puede entregar un premio sin saldo suficiente. Si lo permitís, el saldo queda en 0 y la entrega queda registrada». |
| Revisión | «Se guardarán todos los cambios pendientes del programa. Revisalos y pulsá Activar programa o Guardar cambios cuando estés listo». |
| Cierre | «Elegí el fin de acumulación y una fecha posterior de canje en la zona horaria del negocio. Después revisá la confirmación». |
| Confirmación de cierre | «Confirmar programa el cierre y bloquea la edición. Cancelar vuelve al formulario sin programarlo». |
| Guardado confirmado | «El programa quedó activado/actualizado» según operación, sólo después de respuesta válida y GET válido. |
| Cierre confirmado | «El cierre quedó programado. Revisá las fechas» sólo después de DELETE válido y GET válido. |
| Vista pendiente | «El cambio está confirmado, pero falta actualizar la vista. Pulsá Actualizar vista; no hace falta guardar otra vez». |

En fases operativas, el botón de la guía no sustituye Continuar/Guardar/Confirmar del
formulario: sólo avanza explicaciones que no requieren una operación. Errores conservan
su mensaje de UI; no inventar un éxito ni ocultar Alert con el popover.

## Cuatro ayudas

| Ayuda | Disponible | Recorrido propuesto |
| --- | --- | --- |
| Crear un programa | Sin programa y con acceso de escritura | Modalidad → unidades Puntos o sello/meta Sellos → diseño sólo Sellos → términos/acumulación → premios → revisión → Activar → confirmación de escritura y GET |
| Editar un programa | Programa activo | Editar programa → pasos reales por modalidad → revisar todos los cambios → Guardar cambios → confirmación y GET |
| Programar el cierre | Owner, programa activo | Cerrar programa → explicar consecuencias → fin de acumulación → fecha final de canje/zona horaria → Continuar → diálogo de confirmación → cierre confirmado y GET |
| Editar políticas | Programa activo | Abrir editor en Términos → plantillas opcionales/texto → Permitir canjes sin saldo suficiente en Premios → Revisión → Guardar cambios → confirmación y GET |

Ayudas no disponibles muestran motivo («Primero creá un programa», «Ya hay un programa
activo», «No se puede editar durante el cierre»). Cierre no se ofrece a staff.
Creación se ramifica en cuanto el usuario elige modalidad; cambiarla recalcula fases
sin adoptar un selector de Sellos en Puntos. No obliga a cambiar valores existentes.

Ayuda de políticas: se propone acceso directo al paso Términos, conservando datos.
Ir a Revisión valida el borrador completo; si otro campo está inválido, llevar al paso
real que requiere corrección. Antes de Guardar, explicar: «Se guardarán todos los
cambios pendientes del programa». No representar la operación como guardado parcial.
Owner confirmó el 2026-09-26: «cubramos terminos y condiciones mas permitir canje
sin saldo». La guía incluye el checkbox de Configuración avanzada en Premios para
ambas modalidades. Términos → Continuar validado → Premios, resaltando sólo la regla
de canje → Continuar validado → Revisión. La edición de acumulación o premios completos
se acompaña en Editar programa; políticas conserva esos datos sin ocultar controles ni
saltarse validaciones. Si un borrador previo está inválido, la guía acompaña el error
del paso real hasta poder revisar. No introducir un segundo editor ni endpoint.

## Conducta de las guías

- Un recorrido activo. Salir de la guía mantiene campos, selección de imagen y paso;
  no usa la X de la página ni dispara su confirmación de descarte. La X sigue el flujo
  actual. Iniciar otra ayuda durante edición no llama populate/reset ni pierde borrador.
- Guía observa eventos de apertura, avance validado, recorte y resultado del guardado
  del editor. No usar clicks, timers ni espera de selector como prueba de éxito.
- Los controles normales siguen siendo la única vía de operación. La guía no elige
  archivo, inserta plantilla, modifica fechas ni pulsa Activar/Guardar/Confirmar.
- Imagen Sellos: acompañar picker/recorte sólo si el usuario los abre. Cancelación no
  avanza falsamente ni guarda; preparación bloquea avance como ahora. No exigir imagen.
- Validación mantiene la fase y el foco en error. Durante guardado/preparación/recorte
  no iniciar otra guía; no permitir doble escritura ni retroceder a repetir una operación.
- Cierre: fecha futura y canje posterior, en zona del negocio; confirmar mediante el
  diálogo existente. No avanzar al éxito sólo por abrir el diálogo o pulsar Continuar.
- Usar instancia de recorrido para ignorar respuestas tardías de otra ayuda; operación
  normal aún resuelve su resultado. Cleanup no cancela silenciosamente una escritura.
- Éxito con lectura posterior fallida: informar operación confirmada/vista pendiente,
  resaltar Actualizar vista y ofrecer sólo GET. No pedir Guardar/DELETE de nuevo.
- Red/JSON inválido tras escritura: conservar resultado incierto y consulta GET actual.
  Rechazo 400/409/422/503 mantiene borrador/fase y recuperación actual. 401/403 termina
  guía por acceso, sin registrar skipped; conservar Alert y conducta owner/staff vigente.

## Contratos y archivos

Reutilizar `startOnboardingTour`, `disposeOnboardingTour`, clientes de onboarding y
`loyaltyRequest`; contenido y estado de la guía viven en UI. No modificar el motor
compartido salvo incompatibilidad reproducida y justificada con regresión.

Programa: PUT → `{ programId, created }`; DELETE/PATCH → `{ ok: true }`, luego GET.
Consulta/plantillas/catálogo/upload y errores se conservan según specs 0098 y contratos
0079/0099; no trasladar el guardado de Marca (PUT devuelve DTO) a Loyalty.
Progreso según 0084: owner/email verificado, 200; 400 invalid_body, 404 unknown_tour,
401 unauthorized, 403 del guard, 503 onboarding_unavailable. No cambiar gates.

| Archivos previstos | Cambio |
| --- | --- |
| `loyalty-tour-{definitions,state,context,controller,focus}.tsx/ts` | Copy/anchors, estado local, controller y accesibilidad |
| `loyalty-page.tsx`, `program-editor.tsx`, pasos, `program-view.tsx`, `program-closing.tsx` | Ayuda, anchors y señales reales; intención de inicio en Términos |
| `use-loyalty-program.ts`, `use-stamp-upload.ts` si hace falta | Exponer eventos de resultados/preparación; conservar un único flujo operativo |
| `onboarding-view.ts` y sus tests | Destino program derivado del mismo mapa |
| `globals.css` | Composición responsive/popover scoped, reutilizar estilo de ayudas |
| Tests unitarios y navegador de Loyalty | Estado, permisos, borrador y recorridos reales con HTTP controlado |

Señales a añadir: paso actual validado y modalidad desde ProgramEditor; apertura/cierre
de recorte desde estado stamp; resultado estructurado de escritura con identificador
de intento (confirmed+refreshed, confirmed+refreshFailed, rejected, uncertain). Hoy
`write` captura errores y resuelve sin resultado: la guía **no** puede usar la resolución
de `save`/`closeProgram` como éxito. Emitir/observar el resultado validado en `write`,
conservar guards, requests y un único flujo de escritura. Eventos de guía incluyen
instance; los de operación incluyen attemptId para ignorar respuestas tardías.

No disjunta con 0098: misma página/editor/hooks. Un implementador y revisión independiente
al final, sin paralelizar modificaciones sobre estas piezas.

## Verificación propuesta para la futura implementación

- [ ] Orientación por estado, Listo/Saltar persistidos una vez; repetir y staff sin POST.
- [ ] Cuatro ayudas, ambas modalidades, rol/estado correctos; salto a Términos conserva
  resto del DTO y borrador; salida y X diferentes; errores y respuestas tardías.
- [ ] Cierre nunca escribe sin confirmación; fechas inválidas no avanzan; éxito y
  refresh fallido no repiten escritura. Crear/editar igual bajo PUT demorado o fallido.
- [ ] Teclado/foco/Escape, scroll/popovers/diálogos/recorte en 320/390/768/1280,
  light/dark/reduced motion; sin tapar campos ni checklist. Smoke otros tours si se
  toca infraestructura compartida.
- [ ] Tipos, lint, formato, contraste y controles de compilación relevantes una vez;
  las restricciones de sandbox y QA live acordadas se registran, no se declaran verdes.
- [ ] Cuatro defectos plausibles para medir: persistir ayudas; avanzar tras submit
  rechazado; perder borrador al entrar a políticas; anunciar cierre antes de confirmación.
  Puntos existentes y contratos nuevos se detallan abajo; no son pruebas ejecutadas.

Máximo dos rondas y cuatro mutaciones en esta futura spec; copia/hash/bitácora/restauración
según protocolo. No reutilizar como evidencia las mutaciones de 0098. Fuera: sesiones,
storage, cámara y dispositivos reales sin QA específico; no afirmar producción verificada.

## Oráculos y comandos previstos

Casos nuevos en `tests/e2e/loyalty-tours.spec.ts`,
`loyalty-tour-help.spec.ts` y `loyalty-tour-errors.spec.ts`, apoyados en el fixture
HTTP existente y componentes/CSS reales. Suites unitarias locales para reducer y
parser/definiciones; onboarding-view test verifica que disponible y destino se derivan
del mismo mapa. No editar oráculos existentes para obtener verde.

| Defecto plausible / mutación máxima | Punto del árbol o contrato nuevo | Oráculo que debe fallar |
| --- | --- | --- |
| M1. Persistir una ayuda | Controller nuevo llama startOnboardingTour con persist:false; motor existente persiste por default | Completar/salir de cada ayuda o repetir general deja 0 POST de progreso; onboarding owner Listo/Saltar envía exactamente 1 POST correcto |
| M2. Dar por exitoso un submit rechazado | write de use-loyalty-program valida DTO/captura error; nueva señal de resultado y reducer de tour | PUT 422 o JSON inválido conserva fase/borrador/Alert; no aparece copy de confirmado ni se termina la guía; retry válido conserva una sola operación por intento |
| M3. Rehidratar al abrir políticas | populate actual resetea imagen/earn; nuevo preparePolicies debe cambiar intención/paso sin populate | Con borrador distinto en términos, premios y diseño, entrar/salir de políticas conserva los tres valores y el paso esperado; PUT final contiene cambios completos |
| M4. Cierre completado al abrir diálogo | ProgramClosing actual sólo setConfirmClose; escritura DELETE sólo closeProgram confirmado | Abrir/cancelar diálogo deja 0 DELETE y guía sin éxito; confirmar con respuesta demorada no anuncia éxito hasta DELETE+GET válidos |

Puntos nuevos se localizarán por archivo/línea y hashes antes de ejecutar mutaciones;
esta tabla define el encargo y no presenta mecanismos nuevos como implementados ni
mutaciones ya corridas. Máximo cuatro mutaciones, dos rondas; si no se caza el defecto
por su aserción prevista, registrar FAIL y corregir antes de publicar. Dos rondas con
nuevos defectos encadenados obligan a declarar pendientes/cortar, no ampliar presupuesto.

Con Node de `.nvmrc`, una ronda de gates root antes de publicar:
`pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run format:check`,
`pnpm run build` y `pnpm run test:e2e`. Revisión independiente comparte esa evidencia
general y ejecuta por su cuenta casos de tour relevantes; no duplica gates completos.
Si sandbox impide build/puertos o faltan credenciales aisladas, registrar la salida real
y la alternativa acordada con owner; no convertir skip en PASS. Build Merchant Webpack
es alternativa local conocida de 0098, no un resultado de esta spec. No monitorizar CI
ni afirmar deploy/producción verificados. El owner decidirá QA live tras la entrega.

## Cierre del plan y retorno

Alcance de políticas resuelto por owner: términos y condiciones más canje sin saldo.
Copy, anchors, disponibilidad, señales, oráculos y presupuesto definidos en este plan.
Pendiente únicamente aprobación general de esta versión para marcar spec `cerrada` y
ADR `aceptado`; no atribuir aprobación a decisiones propuestas antes de recibirla.

Tras aprobar, actualizar TASKS/handoff con el estado cerrado, hacer clear y regresar
con «Implementar spec 0100». Un implementador para la spec y un revisor independiente,
según AGENT-WORKFLOW. No iniciar código en esta sesión de planificación.
