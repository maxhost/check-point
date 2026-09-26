# Handoff — Spec 0097

Fecha: 2026-09-25. Estado: UI implementada, **PASS independiente de la UI verificable**.
La [spec 0097](../specs/0097-tours-de-onboarding-y-ayuda-de-marca.md) conserva `cerrada`
por QA real pendiente. [Revisión independiente](spec-0097-revision-ui.md).
Estado de commit/push en TASKS; despliegue no verificado por instrucción del owner.

## Comportamiento entregado

El checklist del owner abre cinco pasos de orientación sin modificar Marca. Ayuda ofrece
nombre, cargar/cambiar logo, quitar logo, colores, zona horaria y moneda. Las seis guías
operan sobre el editor real y no escriben progreso de onboarding. Elegir/quitar imagen
modifica el borrador; éxito requiere PUT confirmado y toma los valores del DTO definitivo.
Guardar envía el borrador completo, congela controles en vuelo y conserva errores y cambios
locales si falla. Un 409 o resultado desconocido permite consultar por GET y requiere
confirmación para adoptar la versión guardada. Salir conserva borrador y recorte.

Página y navegación permiten staff con `brand`; orientación y Crear afiche quedan para
owner. El recorrido completo de afiche queda para una spec posterior. Se reutiliza el
motor de tours, sin cambios de implementación compartidos ni nuevas rutas API.

## Archivos tocados

- `apps/merchant/src/app/backoffice/brand/`: editor, identidad, skeleton, recuperación,
  cliente HTTP, estado/contexto/controlador/foco y definiciones de tours; pruebas unitarias
  del cliente, estado, adaptador de página y navegación. La separación respeta el límite
  de tamaño de módulos del repositorio.
- `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`: Marca delegada.
- `apps/merchant/src/app/backoffice/onboarding/onboarding-view{,.test}.ts`: destino de Marca.
- `apps/merchant/src/app/globals.css`: estilos acotados a Marca, tour y recorte durante guía;
  controles y contraste oscuro, scroll y posicionamiento de recorte en pantallas pequeñas.
- `apps/merchant/src/server/upload-image-formats.test.ts`: sólo ruta del componente extraído;
  conserva las aserciones de formatos. Sin cambios al backend de producción.
- `tests/e2e/brand-{tours,logo,lifecycle,progress,authenticated}.spec.ts` y `support/brand-*`:
  componentes reales, Driver.js, CSS y HTTP controlado; smoke autenticado separado.
- `tests/e2e/support/catalog-harness-server.ts`: entrada opcional para reutilizar servidor;
  conserva entrada de Catálogo por defecto y sus pruebas pasaron en la corrida estándar.
- Spec, ADR 0088, INDEX, TASKS y esta evidencia.

## Comandos ejecutados y resultados

Desde raíz, Node **24.20.0**, pnpm **11.4.0**. Todos exit 0 en código restaurado.

| Gate | Comando | Resultado / artefacto local |
|---|---|---|
| Tipos | `pnpm run typecheck` | 3 tareas exitosas; `/tmp/brand-typecheck.log` |
| Lint | `pnpm run lint` | Sin errores; `/tmp/brand-lint.log` |
| Formato | `pnpm run format:check` | Verde; `/tmp/brand-format.log` |
| Tests | `pnpm run test` | 178 archivos passed / 107 skipped; **1801 passed / 595 skipped**; `/tmp/brand-test.log` |
| Build | `pnpm run build` | 3 tareas exitosas, 2 cached; `/tmp/brand-build.log` |
| Navegador | `pnpm exec playwright test` | Configuración estándar root, equivalente al script `test:e2e`: **48 passed / 5 skipped**, 26,5 s |

Marca: **27 passed / 2 skipped**. Los dos omitidos requieren
`E2E_BRAND_OWNER_STORAGE_STATE` y `E2E_BRAND_STAFF_STORAGE_STATE`; no se proporcionaron
sesiones de desarrollo. Los tres restantes corresponden a smoke existentes de Catálogo
y loyalty. Integraciones que requieren entorno también se omitieron en Vitest.
No se usaron credenciales ni datos de producción.

El build inicial falló por restricciones de bind del sandbox. Tras autorizar ejecución
externa, hubo que apartar la caché generada de Turbopack que repetía ese fallo; el build
final compiló Merchant correctamente. Caché apartada de forma reversible en
`/tmp/checkpoint-brand-turbopack-20260925`. Archivos `next-env.d.ts` generados por estas
corridas restaurados a HEAD, sin cambios ajenos en el diff.

## DoD y evidencia

- [x] Cinco pasos sin writes de Marca, completed/skipped y reintento de progreso;
  consumo de query y desmontaje sin POST: `brand-tours` y `brand-lifecycle`.
- [x] Seis tareas, editor real, salida que conserva borrador/recorte, éxito tras PUT:
  `brand-tours` y `brand-logo`. El probe de contexto comprueba tickets viejos; no simula
  toda la cadena de una subida real que resuelve en otra tarea.
- [x] Errores 422/503, conflicto/GET/reintento/adopción explícita, pérdida de respuesta,
  PUT 401/403 y GET inicial recuperable: `brand-tours`, `brand-logo`, `brand-lifecycle`.
- [x] Adaptador y navegación delegada probados; owner/staff en componentes, sin afiche
  para staff: `page-guard.test.ts`, `brand-navigation.test.ts`, `brand-tours`.
- [x] Controles congelados en vuelo, teclado entre recorte/guía; fixtures claros a 390 px
  y oscuros a 320/1280 px sin overflow. Capturas locales finales:
  `/tmp/brand-320-dark.png`, `/tmp/brand-1280-dark.png`.
- [x] Seis clases de defectos detectadas con aserción pertinente; restauraciones comprobadas:
  [bitácora de mutaciones](spec-0097-bitacora-de-mutaciones.md). Dos verdes iniciales
  explicados y corregidos en mecanismo/oráculo, no contados como evidencia.
- [x] `rg -n MUTATION apps tools` sin coincidencias; seis gates root verdes.
- [x] Orientación con logo existente y POST tardío de progreso 200/503 frente a error
  del editor: `brand-progress.spec.ts`, preservando error y borrador.
- [ ] Smoke autenticado owner/staff contra página real Merchant: omitido por falta de sesiones.
- [ ] QA nativo iOS/Android: cámara, picker, formatos reales, teclado/scroll y regreso a
  edición, claro/oscuro y movimiento reducido. `setInputFiles` no acredita cámara.
- [x] PASS independiente sobre spec y diff, documentado por otro agente en la revisión.

## Límites y siguiente paso

Revisión independiente terminada: un FAIL inicial R1 fue reproducido por el implementador
y corregido antes de publicar. Quitar durante preparación ahora invalida la selección y
limpia `isAnalyzing`; cancelar/reset usan el mismo helper. La respuesta vieja libera su
recurso y no restaura el logo. Prueba de regresión `brand-logo-lifecycle.spec.ts` verde,
sonda independiente original verde y suite Marca del revisor 27 passed / 2 skipped.
Los seis gates root se actualizaron después de la corrección; resultados arriba.

El owner autorizó commit/push a `maxhost/check-point` y luego indicó «no necesitamos
verificar el deploy en vercel». No se declara READY ni SHA servido en producción.
Siguiente paso: QA con sesiones reales y dispositivos. Storage real, concurrencia entre
sesiones y propagación a otras superficies no quedan probados por estos fixtures.

La primera corrida de los dos casos de progreso tardío se detuvo por interacción de
puntero: el checklist flotante restaurado cubría Guardar en el fixture de escritorio.
Se verificó ese caso por teclado (foco y Enter), sin forzar clic ni esconder la UI. La
corrida estándar final pasó. Revisar disposición real del checklist frente al footer
durante el smoke autenticado; esta prueba no acredita que el clic quede libre ahí.

## Cierre de sesión y retorno

UI publicada en `0c1c847`; documentación de entrega en `0e78f3f`, ambos pusheados a
`origin/main` en `maxhost/check-point`. El owner respondió «quedo perfecto. hacemos
handoff, clear y volvemos al trabajo»: aprobación general de la entrega, sin detalle
de dispositivos o escenarios. No completa por sí sola las casillas específicas de QA
nativo/smoke autenticado ni verifica el despliegue que pidió no consultar.

Punto de retorno: `docs/TASKS.md`. Continuar con el diseño de onboarding/ayuda de Crear
afiche, separado según ADR 0088; revisar Brand Kit y sus contratos antes de proponer y
cerrar nueva spec. No reiniciar la implementación de Marca. Este cierre sólo modifica
documentación; los gates de código siguen siendo los registrados arriba.
