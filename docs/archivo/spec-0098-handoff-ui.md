# Handoff — Spec 0098

Estado: UI implementada localmente y revisión independiente aprobada; QA autenticado y
nativo pendiente. El implementador no realizó commit/push; el orquestador coordina la
publicación por pedido del owner, condicionada al build.

## Alcance y archivos tocados

- `apps/merchant/src/app/backoffice/loyalty/`: página delegada, cliente HTTP/DTO,
  estado de lectura/escritura, borrador/payload y validación; editor y sus seis pasos,
  consulta guardada, cierre/fecha, confirmaciones, diseño y carga diferida del sello.
- `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`: destino delegado Loyalty;
  menú móvil de administración para que todos los permisos quepan a 320 px.
- `apps/merchant/src/ui/`: TextAreaField, ChoiceGroup, CheckboxField, exportaciones,
  ariaLabel opcional de progreso y clampOnBlur opt-in de NumberField. Sus defaults
  existentes se conservan; el editor valida enteros escritos sin corregirlos al blur.
- `apps/merchant/src/app/globals.css`: composición Loyalty y aislamiento de controles
  nuevos frente a reglas nativas heredadas; overlay/colores semánticos, sin quitar CSS
  consumido por otras pantallas ni modificar estilos de sus diálogos.
- `docs/design-system.md`, esta entrega y bitácora; pruebas locales de permiso y suites
  `tests/e2e/loyalty-{design-system,states,image,validation,render,regression}.spec.ts`,
  fixtures/entradas locales; harness compartido conserva su entrada por defecto.

## Comportamiento entregado

Owner y staff con loyalty consultan/crean/editan. Catalog es independiente: no se sondea
sin permiso; libre/descuento funcionan y snapshot/id de producto guardado permanece.
Cierre/cancelación y handlers DELETE/PATCH sólo owner. Página exige sesión/loyalty;
capacidad de presentación no viaja en requests. PUT completo conserva plural opcional
Sellos, flag booleano, diseño y mecánica; Puntos omite diseño/carga y normaliza dinero
con coma/punto al payload. Programas guardados requieren GET tras 201/200.

Errores se presentan por code/status, nunca deduciendo permisos del texto. 401/403 bloquean
writes; owner puede verificar explícitamente. El draft persiste ante fallos y consulta
GET. Confirmación de write con refresh fallido sólo ofrece actualizar lectura. JSON/DTO
inválido deja error recuperable y no adopta contexto parcial. Guards síncronos cubren
upload y write, sin autosave. Imagen vieja no restaura selección al cancelar/quitar;
object URLs se liberan. Navegación conserva draft y enfoca título/error; diálogos retornan
foco y empiezan en Cancelar, con Escape y descripción asociada.

## Evidencia ejecutada

Baseline de navegador: **47 passed / 1 skipped**, 41.3 s, Node 24.20.0/Chromium,
`/tmp/spec0098/browser-baseline-final.log`. Componentes reales y CSS final, HTTP controlado.
Copias de capturas en `/tmp/spec0098/final-captures`; la siguiente corrida Playwright puede
reemplazar `test-results`, por eso se guardaron fuera.

- Puntos creación/edición y Sellos creación/edición atravesaron pasos; payload completo,
  decimal con coma, snapshot/plural/flag, modal/descarte, foco, teclado y guardado/GET.
- GET503/DTO/plantillas inválidos recuperan; errores 400/401/403/409/422/503 conservan
  borrador y bloquean acceso según code. Catálogo vacío/error/sin permiso se distinguen.
- Doble submit mismo tick: una escritura con respuesta demorada. GET posterior fallido
  no repite PUT. Respuesta de escritura inválida no anuncia éxito.
- Sello: recorte real, preparación tardía, cancelación y remoción; upload sólo al guardar.
  Cámara nativa y storage real no se acreditan con estos fixtures.
- Render 320/390/768/1280, light/dark: labels/valores/campo de referencia, controles de
  48 px, sin overflow. Capturas de consulta, básicos, diseño, términos, premios, revisión,
  descarte, formulario/resumen de cierre y cancelación. Marcas checkbox 20×20 con flex y
  overlay con alpha medidos. Smoke Marca/Catálogo/Staff/Locales con campos/diálogos reales,
  temas por SO y explícitos, reduced motion. Comparación usa campos del catálogo del wizard,
  sin afirmar aprobación estética ni despliegue.

Cuatro mutaciones plausibles ejecutadas: todas rojas por su propiedad, restauradas con
copia/SHA/diff. M1 avance con monto vacío, M2 skeleton ocultando error, M3 pérdida del
borrador al volver y M4 dos PUT con doble submit. Alcance completo de suites Loyalty;
una ronda, sin ampliar presupuesto. Detalle en
[bitácora](spec-0098-bitacora-de-mutaciones.md) y `/tmp/spec0098/M{1,2,3,4}.log`.

Revisión independiente del orquestador: **50 passed / 1 skipped**, 51.3 s, más
**11/11** unit tests específicos. Incluye los 47 casos Loyalty y tres oráculos propios:
GET malformado recuperable, entero cero sin corrección silenciosa y render de marcas/
overlay. Resultado y alcance en [revisión independiente](spec-0098-revision-ui.md).

Gates root con Node 24.20.0:

| Gate | Resultado | Log |
| --- | --- | --- |
| `typecheck` | PASS | `/tmp/spec0098/gate-typecheck.log` |
| `lint` | PASS; dos firmas de fixtures corregidas y gate repetido | `/tmp/spec0098/gate-lint.log` |
| `test` | PASS: 1806 tests, 595 omitidos; 179 archivos aprobados, 107 omitidos | `/tmp/spec0098/gate-test.log` |
| `format:check` | PASS | `/tmp/spec0098/gate-format.log` |
| Tipos UI | PASS | `/tmp/spec0098/gate-ui-types.log` |
| Contraste | PASS | `/tmp/spec0098/gate-contrast.log` |
| `build` | Turbopack bloqueado por EPERM incluso en retry autorizado/sin caché. Merchant PASS con `next build --webpack` (exit 0, TypeScript y 33 páginas); Consumer/Platform tenían build PASS en caché | `/tmp/spec0098/gate-build.log` y `/tmp/spec0098/gate-build-webpack.log` |
| `test:e2e` general | Pendiente: webServer impedido por EPERM; owner canceló escalación y pidió QA live, sin nueva corrida | `/tmp/spec0098/gate-e2e.log` |

Los fallos EPERM son del entorno de ejecución; no acreditan ni descartan fallos del
producto. La suite controlada de componentes sí se ejecutó fuera del sandbox. Compilación Merchant verificada con Webpack sin cambiar configuración. No se declaran
los seis gates root aprobados: Turbopack y E2E general quedan con los límites anteriores.

## DoD y límites

- [x] Componentes/HTTP/payload/permisos independientes y borrador con evidencia anterior.
- [x] Interacciones, estados de carga/error/escritura, preview/imagen y confirmaciones.
- [x] Render responsive/temas y regresión de superficies compartidas acotada.
- [x] Typecheck, lint, test, format:check, contraste y tipos UI finales registrados.
- [x] Compilación confirmada con alternativa Webpack; límite Turbopack registrado.
- [ ] E2E general, diferido por owner para QA live.
- [x] Revisión independiente final del orquestador.
- [ ] Smoke con sesiones owner/staff reales de desarrollo y QA nativo iOS/Android:
  cámara, picker, recorte, teclado, scroll/checklist flotante y percepción estética.

Fixtures no prueban guards/session/storage reales ni despliegue/producción. El smoke
`tests/e2e/loyalty-real.spec.ts` se omite sin credenciales de desarrollo; conserva su
flujo antiguo y debe migrarse al recorrido nuevo al habilitar ese QA autenticado.
No se editó para obtener verde. No hay bloqueo de backend identificado.

Árbol externo preservado: `server/loyalty-program/client-view.ts`,
`server/loyalty-client-view.test.ts` y docs 0099/INDEX/TASKS previos pertenecen a backend/diseño
anteriores. `apps/merchant/next-env.d.ts` cambió por generación externa de Next (dev/types
→ types) antes de esta verificación; no se atribuye a la implementación. Sin backend,
guards compartidos, schema, wizard ni CardPreview compartido modificados por esta entrega.
