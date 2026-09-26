---
spec: 0100
fecha: 2026-09-26
estado: borrador
resumen: Tour general de Loyalty y cuatro ayudas para crear, editar, programar cierre y editar políticas, reutilizando el editor y el progreso de onboarding existentes.
disjunta: no
archivos: apps/merchant/src/app/backoffice/loyalty/, apps/merchant/src/app/backoffice/onboarding/onboarding-view.ts, tests/e2e/loyalty-*.spec.ts
---

# 0100 — Tours de onboarding y ayuda de Loyalty

**Parqueada por owner el 2026-09-26** para priorizar arreglos del formulario de Loyalty.
Plan preservado en disco; no implementar hasta que se retome y apruebe. Ver [PARQUEADO](../PARQUEADO.md).

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
Copy final y anchors exactos se cerrarán antes de implementar.

## Cuatro ayudas

| Ayuda | Disponible | Recorrido propuesto |
| --- | --- | --- |
| Crear un programa | Sin programa y con acceso de escritura | Modalidad → unidades Puntos o sello/meta Sellos → diseño sólo Sellos → términos/acumulación → premios → revisión → Activar → confirmación de escritura y GET |
| Editar un programa | Programa activo | Editar programa → pasos reales por modalidad → revisar todos los cambios → Guardar cambios → confirmación y GET |
| Programar el cierre | Owner, programa activo | Cerrar programa → explicar consecuencias → fin de acumulación → fecha final de canje/zona horaria → Continuar → diálogo de confirmación → cierre confirmado y GET |
| Editar políticas | Programa activo; alcance por confirmar | Abrir editor en Términos → plantillas opcionales → editar texto → revisión → Guardar cambios → confirmación y GET |

Ayudas no disponibles muestran motivo («Primero creá un programa», «Ya hay un programa
activo», «No se puede editar durante el cierre»). Cierre no se ofrece a staff.
Creación se ramifica en cuanto el usuario elige modalidad; cambiarla recalcula fases
sin adoptar un selector de Sellos en Puntos. No obliga a cambiar valores existentes.

Ayuda de políticas: se propone acceso directo al paso Términos, conservando datos.
Ir a Revisión valida el borrador completo; si otro campo está inválido, llevar al paso
real que requiere corrección. Antes de Guardar, explicar: «Se guardarán todos los
cambios pendientes del programa». No representar la operación como guardado parcial.
La pregunta al owner es si políticas incluye sólo términos o también canje sin saldo.
Si incluye canje, añadir el control «Permitir canjes sin saldo suficiente» de
Configuración avanzada en Premios (ambas modalidades), sin introducir un segundo
editor ni un endpoint nuevo.

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
  Mecanismos/oráculos se localizarán antes de cerrar spec, no son pruebas ejecutadas.

Máximo dos rondas y cuatro mutaciones en esta futura spec; copia/hash/bitácora/restauración
según protocolo. No reutilizar como evidencia las mutaciones de 0098. Fuera: sesiones,
storage, cámara y dispositivos reales sin QA específico; no afirmar producción verificada.

## Decisiones pendientes

1. Alcance de «políticas»: términos solos o términos y regla de canje.
2. Aprobar cinco pasos generales, cuatro ayudas y acceso directo a Términos.
3. Cerrar copy, anchors por estado y oráculos exactos antes de implementar.

No hay cambio backend identificado. Este borrador no autoriza iniciar código.
