# Handoff — implementar Loyalty, spec 0098

Fecha: 2026-09-26. Diseño aprobado; UI pendiente. El owner autorizó:
«ok, si estas listo podemos hacer clear y regresas para implementar el spec 0098».
Handoff guardado antes de `/clear`; la siguiente sesión implementa, sin repetir aprobación.

## Punto de retorno

1. `docs/TASKS.md`, sección superior de Loyalty. El bloque de ESTADO de Marca debajo
   corresponde a una entrega anterior y no describe el árbol actual.
2. `docs/specs/0098-loyalty-sistema-de-diseno-del-backoffice.md`, **cerrada**;
   `docs/adr/0089-loyalty-reutiliza-el-sistema-del-wizard-merchant.md`, **aceptada**.
3. Contratos `docs/specs/0079-contratos-de-api.md` §2–3 y
   `docs/specs/0086-contratos-de-api.md` §1–2/6–8. El 0086 actualiza errores/permisos
   del 0079; no usar `not_owner` para el guard de GET/PUT delegables.
4. Contrato 0081 para acumulación/plantillas. Revisar si ya existe
   `docs/specs/0099-contratos-de-api.md`: al preparar este handoff no existía;
   la spec de backend 0099 está presente y planea consolidarlo. No implementarla aquí.
5. `docs/design-system.md`, `src/ui/index.ts`, wizard de alta y componentes actuales de
   Loyalty. Leer `apps/merchant/AGENTS.md` y documentación Next local antes de escribir código.
6. `docs/AGENT-WORKFLOW.md` y `.claude/skills/protocolo-de-verificacion/SKILL.md`
   antes de organizar implementación/revisión y pruebas. La spec exige un implementador
   y revisión independiente final, con presupuesto y condición de corte escritos.

## Alcance que debe sobrevivir

- `/backoffice/loyalty`: carga/error, creación, edición, revisión, consulta activa/en
  cierre, fechas y tres confirmaciones. Inputs/labels/placeholder/ayuda/error como el
  wizard merchant; conservar pasos de Puntos/Sellos, mecánica y fórmulas actuales.
- Reutilizar campos, Button/Alert/ProgressIndicator de `src/ui`; nuevas piezas neutrales
  TextAreaField/ChoiceGroup/CheckboxField. Fecha local/color/carga compuestos especializados;
  cropper diferido y CardPreview compartido conservados. CSS acotado y temas light/dark.
- Consulta representa reglas, premios y diseño ya persistidos. Sin métricas nuevas,
  tours, backend, migraciones, rediseño del wizard ni cambios de guard compartido.
- Página/navegación con permiso loyalty; owner y staff autorizado consultan/crean/editan.
  DELETE/PATCH y controles de cierre/cancelación sólo owner. Sesión/capacidades declaradas,
  sin sondeo de endpoints para inferir permisos. Staff no verifica email.
- catalog es independiente: sin ese permiso, no consultar catálogo; libre/descuento
  siguen disponibles y los premios de producto existentes se conservan por snapshot/id.
- PUT completo según modalidad; conservar plural opcional de Sellos y flag booleano
  hidratado. Puntos exige unidades/dinero/costo y omite diseño/carga de sello. Clauses
  explícitas en este editor, distinguiendo omisión (semillas) de [] (422) en la API.
- PUT confirma `{programId,created}` y requiere GET para DTO. No asumir respuesta de
  Marca. Fallo del refresh tras write confirmado sólo reintenta lectura. Error mantiene
  borrador; validar/foco por campo, sin autosave y sin requests duplicados.

## Estado del árbol observado

`git rev-parse --short HEAD`: **c85e986** al preparar el handoff. No inferir que esté
publicado ni que sea el SHA servido por producción. Releer `git status` al retomar:
hay actividad de backend fuera de este encargo y el estado puede cambiar.

Ya estaban presentes, además de nuestros documentos, cambios en
`apps/merchant/src/server/loyalty-program/client-view.ts` y el archivo nuevo
`docs/specs/0099-el-dto-del-programa-y-el-contrato-vigente.md`.
`docs/INDEX.md` incluye una sección de la 0099 que debe preservarse.
Al verificar el cierre apareció también modificado
`apps/merchant/src/server/loyalty-client-view.test.ts`; pertenece al trabajo de backend
presente en el árbol y tampoco fue editado/verificado por este handoff.
No revertir, sobrescribir ni atribuir esos cambios a la implementación de UI.
Este handoff no modifica backend ni hace commit/push.

Documentos de esta entrega: spec 0098, ADR 0089, sección Loyalty de INDEX/TASKS y este
handoff. El análisis de UI se hizo por lectura de código/CSS; la apertura web de
producción falló. No hubo inspección autenticada ni comparación renderizada de Loyalty.
Se verificó formato de spec/ADR y `git diff --check` durante el diseño; no se ejecutaron
gates de aplicación para una implementación de UI que todavía no existe.

## Implementación y verificación siguientes

Implementar todo el alcance en módulos pequeños. No avanzar sólo con cambios de clases:
deben quedar formularios, estados y permisos coherentes con la spec. Leer archivos
actuales antes de editar; reutilizar el harness Playwright existente cuando corresponda.
Verificar reglas y componentes reales con HTTP controlado, payload, acceso/navegación,
errores, borrador, imagen tardía, teclado, mobile/desktop y estilos computados comparados
con el wizard. Capturas desde 320 px, light/dark y regresión de las superficies compartidas.

Presupuesto de **cuatro mutaciones** y máximo dos rondas, según la spec. Localizar los
mecanismos después de implementar, baseline/copia/shasum y bitácora antes de medir;
restauración comprobada. Gates root Node 24 una sola vez al final: typecheck, lint,
test, format:check, build y test:e2e, más contraste/tipos UI. Revisor independiente;
no declarar PASS antes de evidencia. Fixtures no prueban auth real, storage/cámara
nativa ni producción; registrar esos límites y QA iOS/Android pendientes.

No publicar como consecuencia de este handoff. La autorización actual es implementar
la 0098; preparar la entrega revisable y reportar su validación al owner.
Commit documental sugerido, pendiente de autorización: `docs: close loyalty UI spec 0098
and save implementation handoff`; incluir sólo los documentos de esta entrega y
preservar la sección de 0099 en los archivos compartidos.

## Prompt para la sesión nueva

«Implementá el spec 0098. Leé docs/TASKS.md y
docs/handoff-loyalty-ui-2026-09-26.md; el diseño ya está aprobado.»
