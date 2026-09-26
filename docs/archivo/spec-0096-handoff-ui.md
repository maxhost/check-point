# Handoff — Spec 0096

Fecha: 2026-09-25. Estado: UI y pruebas en `3c9be45`, pusheado a `origin/main`, con PASS independiente acotado; QA real pendiente.

## Entrega

Orientación de cuatro pasos desde el checklist y ocho ayudas desde Catálogo → Ayuda.
Estado por instancia/tarea/id, avance por respuesta confirmada, elección explícita de fila,
confirmaciones de borrado, reintento de lectura sin duplicar escrituras, seguimiento del
importador existente y salida que conserva la operación. Ayuda no guarda onboarding.
Progreso de orientación muestra error/reintento; el checklist reaparece al cerrar.

Archivos: módulos de `backoffice/catalog`, adaptador de sesión en `catalog/page.tsx`, motor,
checklist y mapping de `backoffice/onboarding`, CSS acotado y pruebas de unidad/navegador.
No se modificaron `app/api`, `server`, schema ni migraciones.

## Evidencia del implementador

Node 24.20.0. Resultados ejecutados:

- `pnpm run typecheck` y `pnpm run lint`: exit 0.
- `pnpm run test`: 174 archivos passed, 107 skipped; 1789 tests passed, 595 skipped.
  Los skipped de integración requieren configuración de servicios que no está en este checkout.
- `pnpm exec playwright test` (mismo comando de `test:e2e`): 21 passed, 3 skipped.
  Incluye 18 casos de UI de catálogo y los tres health. Los omitidos son owner/staff
  autenticados de catálogo y loyalty real; no hay storageState de prueba configurado.
- `pnpm run build`: exit 0, tres apps compiladas (29.068 s). El primer intento
  dentro del sandbox falló al abrir un puerto y Turbopack conservó ese fallo. Escalar
  y forzar Turbo no lo quitó; apartar solamente `.next/cache/turbopack` a `/tmp`
  permitió completar el comando estándar. No se modificó fuente ni configuración.
- `pnpm exec turbo run build --filter=@mi-pasaporte/merchant -- --webpack`: exit 0;
  compilación, tipos, páginas y trazas de producción completos. Comprobación complementaria,
  sin cambiar el comando estándar.
- `pnpm run format:check`, `git diff --check`, hook de tamaños y guard de experimentos:
  exit 0. El hook de tamaño rechaza un control de 301 líneas con exit 2.
- Suite unit root repetida después de correcciones: 1789 passed / 595 skipped (23.51 s).
- Full browser final, CSS en orden de producción y capturas estabilizadas:
  21 passed / 3 skipped (12.6 s). [Revisión independiente final](spec-0096-revision-ui.md): PASS para la UI verificable; QA real pendiente.

Seis defectos plausibles, una ronda, registro en
[bitácora](spec-0096-bitacora-de-mutaciones.md). No se presupone que todos produzcan rojo.

## Alcance de las pruebas de navegador

`tests/e2e/support/catalog-harness-server.ts` monta los componentes reales, Driver.js,
ReactAria y CSS compilado; sustituye únicamente navegación Next y respuestas HTTP del
navegador. Los fixtures son contratos de UI, no prueba de guards API, DB, IA ni almacenamiento.
Hay pruebas de guard del adaptador de página con sesión doblada y smoke tests opcionales
contra `/backoffice/catalog` real, que se omiten sin sesión real de desarrollo.

Para ejecutar los smoke tests reales: preparar owner/staff en DB aislada y proporcionar
`E2E_CATALOG_OWNER_STORAGE_STATE` / `E2E_CATALOG_STAFF_STORAGE_STATE`; opcionalmente
`E2E_CATALOG_BASE_URL` (default `http://127.0.0.1:3001`). No usar sesiones de producción.
Esto no añade endpoints de prueba ni altera la autorización de la página.

## QA pendiente y responsabilidades

Probar `/backoffice/catalog?tour=onboarding` como owner y las ocho opciones de Ayuda.
En iOS/Android comprobar cámara, PDF, selección de varias fotos, teclado abierto, scroll,
retorno de foco, claro/oscuro y movimiento reducido. `setInputFiles` no valida el selector
nativo ni la calidad de extracción. No se declara ejecución de esas comprobaciones.

Codex mantiene toda la UI. Claude Code conserva API, autorización, dominio e IA.
Ningún cambio de backend identificado; para QA autenticado hacen falta fixtures/sesiones
reales de desarrollo, no una API nueva. Implementación en `3c9be45`, pusheada a `origin/main`;
el despliegue de producción no está verificado.

## Correcciones de la primera revisión

- Sesión/permisos durante `GET /api/catalog` posterior a una escritura: root reprodujo
  401 y 403 con dos tests rojos; revisión reprodujo el mismo defecto desde producto.
  `reload` ahora termina la ayuda y preserva el mensaje de sesión/permisos; la escritura
  confirmada conserva reintento de lectura. Tests nuevos de categoría: 2 passed (13.0 s).
- Filtros sin filas durante editar/borrar producto: root reprodujo ambos hermanos con
  clic del buscador bloqueado por overlay. Se conserva el filtro y se destaca un
  contenedor persistente que incluye toolbar y lista; sin resets ni cambios CSS globales.
  Oráculos en `catalog-tour-filters.spec.ts`; full browser tras ambos fixes:
  21 passed / 3 skipped (12.9 s).

## Segunda y última corrección de revisión

Una respuesta de fotos aceptada inmediatamente podía desmontar el anchor de análisis
antes del RAF del controlador. Reproducido en full browser con CSS en el orden real
(`driver.css` antes de `globals.css`); 20 passed / 1 failed / 3 skipped. El controlador
ahora lee la sesión más reciente y, si el anchor del import desapareció porque el modal
ya muestra otra fase, sigue esa fase visible en vez de terminar la guía. No añade polling
ni llamadas API. Los tres escenarios de importación repetidos tres veces: 9 passed
(21.6 s). Capturas esperan anchor activo y opacidad completa; la imagen temprana no
se usa como evidencia de layout estable. Cierre independiente: [PASS de la UI verificable](spec-0096-revision-ui.md), DoD completa pendiente de QA real.
