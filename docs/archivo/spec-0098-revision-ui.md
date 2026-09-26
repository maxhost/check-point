# Spec 0098 — revisión independiente de UI

2026-09-26. Revisor: orquestador; implementador único separado. El revisor no editó
código de la implementación. **PASS de la UI verificable en navegador local**, sujeto
a los controles generales registrados en el handoff y a los límites de QA siguientes.
Commit/push autorizados por owner para QA live; sin inspección de producción.

## Evidencia propia

Con Node 24.20.0 y Chromium, el revisor ejecutó
`pnpm exec playwright test --config=/tmp/spec0098-review/playwright.config.ts` sobre
el árbol restaurado: **50 passed / 1 skipped**, 51.3 s. Incluye los 47 casos Loyalty y
tres casos adicionales independientes: DTO malformado recuperable, entero cero que
debe impedir avance y anatomía de radios/checkbox/overlay con Escape. Componentes y
CSS reales, transporte HTTP controlado. Configuración y casos adicionales conservados
en `/tmp/spec0098-review`; los oráculos permanentes también cubren estos defectos.

El revisor ejecutó además las suites `page-guard.test.ts`, `use-rewards.test.ts` y
`card-preview.test.ts`: **3 archivos / 11 tests passed**. Revisó adaptador SSR,
navegación delegada, hooks HTTP/escritura/imagen, validación, payload completo y controles
compartidos. Los cambios previos de backend 0099 quedan fuera de esta revisión.

Se inspeccionaron capturas finales a 320 px en dark (diseño y descarte), más superficies
Marca/Catálogo/Staff/Locales. La matriz automatizada cubre 320/390/768/1280 y light/dark,
consulta, pasos, revisión y cierre/confirmaciones; mide geometría y estilos computados,
sin overflow. Capturas conservadas en `/tmp/spec0098/final-captures`. No equivalen a
aprobación estética del owner.

## Hallazgos corregidos y comprobados

- Un GET con `program: {}` adoptaba contexto parcial y rompía render. Ahora valida DTO
  antes de adoptarlo y mantiene Alert/reintento; caso independiente verde.
- El mínimo de NumberField corregía cero al perder foco y permitía avanzar. Loyalty
  conserva el valor escrito y valida; la opción nueva mantiene el default previo para
  otros consumidores. Caso independiente verde.
- CSS heredado convertía la marca de Checkbox en una franja. Radios y checkbox usan
  flex explícito; medidas finales 18/20 px y objetivo interactivo ≥44 px.
- El overlay de confirmación era transparente por una clase sin token mapeado. Usa
  `--ui-overlay`; el caso independiente mide fondo efectivo y cierre con Escape.

La primera corrida propia tuvo dos fallos de interacción a 1280 px porque el harness
omitía el wrapper del layout real. Se corrigió el fixture, sin cambiar app por ese
artefacto. La corrida final anterior reemplaza ese resultado.

## Mutaciones y restauración

Se leyó la [bitácora](spec-0098-bitacora-de-mutaciones.md) y las aserciones rojas de los
cuatro logs. M1 avanzó indebidamente con monto vacío; M2 ocultó recuperación con skeleton;
M3 perdió el nombre al volver; M4 produjo dos PUT en el mismo tick (esperado 1, recibido
2). Fallos de la propiedad prevista, sin error de setup. Cuatro mutaciones, una ronda;
el revisor no amplió el presupuesto.

El revisor comparó los cuatro archivos finales con sus copias limpias y sus SHA-1:
`deb7710e331f23de17ef8292596437398feb7f80`,
`f11fe30da988f4ebf390694a6fc1737c75eb3ae8`,
`27650300d7cfc7086b73c8337437bb6752895ff0` y
`f78a104f4ac70b3a794dc7529803642ee528d8ff`: pares idénticos, diff vacío. La suite final
propia se ejecutó después de la restauración. Barrido de marcadores y diff final en el
[handoff](spec-0098-handoff-ui.md).

## Controles generales y publicación

El revisor leyó logs finales: typecheck, lint, 1806 tests/595 omitidos, formato, tipos UI
y contraste PASS. Merchant `next build --webpack` terminó exit 0 con TypeScript y 33
páginas; Consumer/Platform tenían build PASS en caché. El build root con Turbopack falló
por EPERM al crear proceso/puerto, incluso en retry autorizado sin caché. E2E general
no inició por puertos del sandbox. El owner pidió dejar esa suite y hacer commit/push
para QA live; no se presenta como seis gates root verdes.

## Límites

No se acreditan sesiones/guards reales, R2/storage, cámara nativa, QA iOS/Android ni
despliegue con fixtures. El caso autenticado se omite sin credenciales aisladas; su
flujo antiguo necesita migración antes de usarlo para ese QA. El contrato de sesión se
revisó mediante adaptador unitario y capacidades, sin convertirlo en smoke autenticado.
La entrega local queda revisable con esos pendientes explícitos.
