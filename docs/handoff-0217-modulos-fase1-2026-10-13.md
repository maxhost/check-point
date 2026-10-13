# Handoff — Spec 0217

Estado: implementado en dev; PASS adversarial de Claude pendiente. Spec permanece cerrada.

Commits: spec `f656cb6`; UI `6f2272f`; capturas POS `b2482c4`; extensión medida de CI `6fe87da`; espera de imagen landing `8e837c8`. Sin merge ni push.

## Archivos tocados

- Stock/Recetas y su test de cantidades trasladados de app/backoffice a modules/<id>/ui; páginas estáticas borradas; ui-registry actualizado. Solo imports cambian; URLs y payloads se conservan.
- backoffice-navigation usa moduleNavigation con rol/permisos y un mapa de iconos; cualquier integrante lee módulos. Mantiene protección frente a GET anterior a evento confirmado.
- settings/module-navigation, module-request, module-settings y use-business-modules: DTO completo, nombres/descripciones/sugeridos/dependencias de API, errores 409 missing/dependents, lectura/reintento y confirmación antes de publicar. POS sigue en su configuración existente.
- Equipo: staff-contract, permission-picker, staff-views y staff-console. Labels/descriptions de manifiestos en selector y listado. Apagados quedan deshabilitados; selección previa no se elimina al editar otros permisos. Administrador y propios conservan protecciones; fallo GET ofrece reintento y bloquea nuevos permisos de módulo; 422 tiene copy accionable y conserva borrador.
- Dos listas pendientes de los tests de frontera vaciadas conforme al encargo. Sin ampliar excepciones.
- E2e module-settings/ticket-settings, nuevos modules-ui/staff-modules y sus fixtures. Tercer módulo sintético verifica extensión sin nombres fijos. POS guarda capturas con testInfo.outputPath. Landing espera hasta 30 segundos por naturalWidth > 0, manteniendo el presupuesto total de 120 segundos y todos los umbrales.

No se tocaron API, servidor, paquetes, migraciones ni kit. Los tests de frontera se editaron por autorización explícita del encargo. El trabajo paralelo 0218 de Claude, archivos generados y assets sin seguimiento se preservó.

## Comandos ejecutados y resultado

Node 24.20.0. Tipos de merchant, ESLint de archivos propios, git diff --check y guardia UI --base origin/main verdes (37 archivos de trabajo actual, sin aumentos). Frontera (12), cantidades Recetas (13) y staff-contract (23): 48/48 en 6.24 s en el árbol compartido. PENDING_GPT={} y PENDING_GPT_DIRS=[].

`pnpm test:e2e -c /private/tmp/checkpass-0217.playwright.ts module-settings.spec.ts staff-modules.spec.ts modules-ui.spec.ts ticket-settings.spec.ts`: 21/21 en 13.2 s. `pos.spec.ts -g '0209 nota'`: 4/4 en 4 s. Las capturas de Ajustes, Equipo, Stock y Recetas a 390/1280 fueron vistas. Escrituras HTTP simuladas con payloads exactos; no QA autenticado con datos reales.

## Verificación completa aislada

Copia `/private/tmp/checkpass-0217-verify`, HEAD 0f3cb87 + archivos propios superpuestos; no incluye los cambios sin commit de Claude 0218. Los 30 archivos propios se compararon byte a byte contra el árbol compartido: idénticos. Dependencias del lockfile instaladas; cachés y servidores originales preservados. DATABASE_URL y DATABASE_URL_UNPOOLED retiradas de los env de la copia: las suites Neon solo usaron tools/neon-test.sh con la rama CI.

Tabla REAL de la ejecución única de `pnpm verify`:

| Gate | Resultado | Segundos |
|---|---|---|
| typecheck | ok | 18.3 |
| lint | ok | 8.4 |
| ui-guard | ok | 1.0 |
| format:check | ok | 9.6 |
| test | ok | 75.9 |
| build | ok | 47.5 |
| test:e2e | ROJO inicial (imagen landing) | 101.8 |
| neon (full) | ok | 462.9 |

Unitarios globales: 2628 pasaron, 1148 omitidos. Los cuatro builds (Turbopack incluido) pasan; Merchant declara /backoffice/[module]/[[...path]] y ya no declara rutas fijas Stock/Recetas. Wrapper Neon CI completo: 3531 pasaron, 282 omitidos.

La corrida única de verify devolvió ROJO por naturalWidth del hero de landing desktop tras 5 s. Se corrigió únicamente su presupuesto de espera. Landing Turbopack EN FRÍO, sin .next previo: 4/4 en 34.6 s. Primera repetición global e2e normal: 368 pasaron, 21 omitidos, 18 fallaron por ERR_CONNECTION_REFUSED del servidor Merchant. No se alteraron esas pruebas. Repetición con servidores nuevos, sin reutilización, `CI=true DEBUG=pw:webserver pnpm test:e2e --workers=2 --retries=0`: **345 pasaron, 62 omitidos, cero fallos**, 2 min. Las omisiones adicionales corresponden a la suite WebKit (CI no instala ese navegador) y a goldens locales de Mac omitidos en CI, según ui-kit.webkit.spec.ts:6 y support/ui-kit-checks.ts:490; sus aserciones no se cambiaron. No se repitieron los gates ya verdes de tipos/unitarios/build/Neon después de modificar solo la espera del e2e.

Logs: /private/tmp/checkpass-0217-verify.log (tabla original), /private/tmp/checkpass-0217-global-e2e-fresh.log (gate CI final), /private/tmp/checkpass-0217-e2e-final.log (21), /private/tmp/checkpass-0217-pos.log (4), /private/tmp/checkpass-0217-landing-cold.log (4). Capturas: /private/tmp/checkpass-0217-results y /private/tmp/checkpass-0217-landing-cold-results.

## DoD

- [x] Las listas de frontera vacías y sus suites verdes.
- [x] Tipos, lint, formato, guardia, unitarios y builds ejecutados y verdes.
- [x] E2e de módulos/Ajustes/Equipo y POS verdes; gate global CI repetido verde.
- [x] Verify único con tabla transcrita y fallo inicial corregido; Neon CI completo verde.
- [ ] Revisión adversarial de Claude sobre servidor 0216 + UI 0217; QA del owner antes de publicar.

## Hallazgos y límites

La implementación está lista para revisión; esto no es un PASS independiente. El revisor debe partir de docs/specs/0217-pantallas-modulos-fase1.md y los diffs b2482c4/6f2272f/8e837c8, repetir la frontera vacía y revisar menú, dependencias y permisos junto al servidor 0216. No se afirma verify verde en una sola invocación ni verificación de los cambios sin commit de Claude 0218. Sin despliegue ni escritura de producción.
