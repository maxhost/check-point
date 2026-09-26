# Handoff — Revisión independiente de Spec 0097

Fecha: 2026-09-25. Estado final: **PASS de la UI verificable**, tras cerrar el FAIL inicial R1.
Revisor independiente del implementador; revisión del diff completo, incluidos archivos nuevos.

## Archivos revisados

Spec 0097, ADR 0088, CLAUDE.md, AGENT-WORKFLOW y protocolo de verificación;
editor/identidad/recuperación/cliente HTTP/logo/contexto/estado/controlador/foco/definiciones,
adaptador y navegación, checklist y motor compartidos, CSS y pruebas unitarias/e2e.
La extracción de `brand-skeleton`/`brand-identity` y el cambio de ruta del test de formatos
conservan alcance y aserciones. Backend de producción sin cambios.

## R1 inicial cerrado — Quitar durante análisis dejaba el editor bloqueado

`use-brand-logo.ts:81` limpia `isAnalyzing` sólo si coincide `choiceSequence`.
`remove():127` invalida esa secuencia sin limpiar el flag; `brand-identity.tsx:114`
mantiene Quitar habilitado durante el análisis. Con logo existente, elegir un PNG y pulsar
Quitar antes de terminar el probe deja «Preparando imagen…», Guardar marca y Elegir logo
deshabilitados aun cuando el probe termina. El borrador requiere recargar para recuperarse.

Reproducción ejecutada sobre el componente real, CSS y HTTP controlado: probe `Image`
diferido 1200 ms; elegir archivo, esperar Preparando imagen, pulsar Quitar, esperar Guardar
habilitado. **Rojo por la propiedad:** esperaba enabled y recibió disabled durante 4000 ms.
Sonda temporal `/tmp/brand-independent-review/reviewer.spec.ts`; trace en su carpeta results.
No es una mutación del código de implementación. El implementador corrigió la cancelación de análisis al
invalidar selección y agregó la prueba de regresión antes de publicar.

**Revisión de la corrección:** `invalidateChoice` incrementa secuencia y limpia
`isAnalyzing`; remove/cancelCrop/reset usan ese helper. La resolución vieja libera su
object URL y no restaura selección. Sonda original ahora verde; la nueva
`brand-logo-lifecycle.spec.ts` espera explícitamente el probe viejo después del PUT remove
y comprueba ausencia de cropper/logo, controles habilitados y una sola escritura sin upload.

## Comandos ejecutados

- Node 24.20.0: `pnpm --filter @mi-pasaporte/merchant exec vitest run src/app/backoffice/brand/brand-api.test.ts src/app/backoffice/brand/brand-tour-state.test.ts src/app/backoffice/brand/page-guard.test.ts src/app/backoffice/brand/brand-navigation.test.ts` — **11 passed**, 4 archivos, exit 0.
- `pnpm exec playwright test --config=/tmp/brand-independent-review/config.ts` — primera
  corrida **1 failed / 1 passed**, exit 1. R1 falla por el flag, no por setup.
- Repetición del comando de sondas después del fix — **3 passed**, exit 0: R1,
  colapso/clic real del checklist y botón Saltar medido a 48 px de alto.
- `pnpm exec playwright test --config=/tmp/brand-review.config.ts` — suite de Marca
  ejecutada por el revisor después del fix: **27 passed / 2 skipped**, 21,2 s, exit 0.
  Incluye la regresión nueva y todos los componentes/tours/logo/lifecycle/progreso.
- `git diff --check` — exit 0.
- `rg -n MUTATION apps tools` — sin coincidencias.

## Checklist flotante y límites

En fixture desktop 1280×720 el checklist sí intercepta el centro de Guardar marca según
`document.elementFromPoint`. Colapsar su resumen permite clic real y PUT exitoso: sonda
independiente aprobada, sin force ni quitar elementos. La prueba de progreso tardío usa
teclado y no acredita disposición libre de clic. Es una limitación recuperable del layout
compartido existente, pendiente de QA con página autenticada; no se declara corregida.

Seis gates root del implementador registrados en handoff; no repetidos completos sin
cambios. Sesiones owner/staff aisladas y QA nativo iOS/Android siguen pendientes.
Fixtures no acreditan cámara, storage real, HEIC/AVIF reales, teclado virtual ni concurrencia
entre sesiones. Permisos se comprueban además en adaptador/navegación, sin bypass server-side.

## DoD contrastada y alcance del PASS

- [x] Cinco pasos sin writes de Marca; completed/skipped/reintento, query consumida,
  logo opcional, desmontaje y progreso tardío comprobados en navegador real.
- [x] Seis ayudas sin progreso, borrador completo conservado, guardado por DTO normalizado
  y controles congelados; fallos de API/upload, resultado desconocido y 409 recuperables.
- [x] Cropper, picker/fallback/cancelación, salida y keyboard combinados; R1 ahora cerrado
  con sonda propia y regresión que observa la resolución vieja.
- [x] Guard de página/navegación y rol owner/staff; afiche oculto a staff y backend
  existente mantiene alcance brand, sin ampliar autorizaciones ni serializar R2 keys.
- [x] CSS local, 320/1280 oscuro sin overflow y controles de guía con área táctil;
  motor compartido sin cambios de implementación.
- [x] Presupuesto original de seis defectos medidos/restaurados, bitácora con verdes
  iniciales explícitos y oráculos corregidos; sin nuevas mutaciones en esta revisión.
- [ ] Smoke autenticado: dos casos omitidos por falta de storageState de desarrollo.
- [ ] QA iOS/Android y superficies externas/storage real/concurrencia.

El PASS permite publicar esta UI para QA; no equivale a DoD completa ni a producción
verificada. R1 no queda abierto. La autorización de despliegue/commit/push y la comprobación
del SHA del deploy corresponden al orquestador. Los seis gates actualizados por el fix
se registran en el handoff del implementador antes del push.
