# 0242 — CP1a cliente POS: entrega

Base `7c16236f79aae8716ee6d0fc395edcb1290475ac`; producto/build `2c4ef9eb6c8487b4ecce8b65c9b97bd2e650bdec`. WT `/private/tmp/checkpass-pos-0242/pos-ui-0242`, rama `pos-ui-0242`. El commit posterior añade solo corrección del oráculo de impresión autorizado, observador del runner, teardown propio y este handoff. Ningún cambio de producto después del build. No push, PROD, M0 rerun ni afirmación M1.

## Cambio y contrato

`usePosContext` adapta las APIs públicas existentes del BackofficeProvider: core, módulos y `captureTicket('session')`. No modifica core ni enum de recursos. Seed ready evita GET sesión/módulos propio; loading no concede permiso ni inicia lecturas POS. Provider presente retirado no toma ruta legacy; esta permanece únicamente sin provider. El transporte pasa scope a panelRequest, captura antes del await, comprueba identidad/época al responder y descarta tardíos antes de aplicar datos o retirar otro ámbito. 401/scope409 llaman al retiro documental compartido; 402/403/conflicto conservan clasificación y motivos.

La consola tiene una instancia privada por scope+época; otro scope, incluso con igual user/business, desmonta historial/orden/borrador/pago/cliente/cupón/ticket/dispositivo pendiente. Cambios de presentación del mismo ámbito conservan instancia y formulario, sin cascada de lecturas. Cache mantiene claves locales de catálogo, generaciones de lectura, deduplicación y versiones monotónicas. El cierre conserva request capturado junto a orden/UUID/cuerpo del intento incierto; no recaptura una identidad nueva al reintentar. Se mantienen DTO unit, total cero y pagos vacíos.

Inventario completo de transporte adoptado (todos pasan por panelRequest):

- `pos-cache.ts`: GET orders (incluido voided), order/:id, catalog por local.
- `pos-console.tsx`: GET session solo compatibilidad sin provider; POST orders, PUT order/:id, POST void. Recuperaciones leen mediante cache.
- `pos-payment-actions.ts`: POST resolve; GET coupon-state, payment-methods y order/:id de recuperación; POST close con transporte congelado. Sin nueva API de cupón global en POS.
- `pos-printing.ts`: GET ticket; callbacks de dispositivo comprueban identidad/generación existente.
- `pos-tables.tsx`: GET tables por local con cliente de contexto local.
- `ticket-settings.tsx`: GET y PUT ticket-settings con cliente de contexto local.

No backend de producto/schema/kit/guard/deps/editor/rediseño/peso. Ampliación expresa de coordinación `bb77c235`: únicamente caso584 de `tests/e2e/pos-printing.spec.ts`, para adaptar el oráculo401 al retiro documental.

## Evidencia y comandos

Node `v24.20.0`, pnpm `11.4.0`, Next `16.3.0`. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use`. Identidades completas de config/lock/schema/migraciones/runner/fixture en `/private/tmp/checkpass-pos-0242/scope-client/evidence-identity.json`. Config CI seleccionada de solo lectura en `/private/tmp/checkpass-pos-0242/private/{selected.json,ci.env}`; endpoint protegido `4e09cdfbd634`. Cookies y manifest con sesiones exclusivamente en `scope-client/native-private.json`, modo0600; no serializados en evidencia pública.

- `pnpm --filter @mi-pasaporte/merchant typecheck` PASS; `typecheck:ui` PASS temprano. ESLint sobre todos los archivos asignados y la ampliación PASS. Prettier focal/diff PASS; `node tools/ui-guard.ts --base 7c16236f` PASS sin aumentos. Guard intacto.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/pos-context.test.ts apps/merchant/src/modules/pos/ui/pos-cache.test.ts tools/app-boundary.test.ts`: **15/15 PASS**, cero skips. Incluye descarte tardío A sin retirar B, scope409/401 frente a402/403/conflicto, retiro sin unscoped, transporte/cuerpo idénticos y bloqueo de retry con otro scope, generaciones, monotonicidad y deduplicación.
- `pnpm exec playwright test -c /private/tmp/checkpass-pos-0242/scope-client-playwright.config.ts`: **13/13 PASS**, cero retries/skips: cinco casos propios (seed, loading, settings409, borrador mismo ámbito, mismo user/business con scope distinto y ticket A tardío409) más ocho casos existentes de pagos, incluido cierre incierto idéntico, cupón total0 y COP. Config temporal ejecuta solamente `pos-context.spec.ts` y `pos-payment-methods.spec.ts`, sin servidores Next compartidos. Artefactos en `scope-client/browser`.
- `pnpm exec playwright test -c /private/tmp/checkpass-pos-0242/scope-client-print-playwright.config.ts -g 'tardío|revocada|revocar'`: **3/3 PASS** tras adaptar únicamente el caso autorizado. Comprueba impresión pendiente,403 y401. Artefactos en `scope-client/printing-browser`.

Browser componente usa APIs controladas y React de producción del harness. StrictMode está presente en fixture, pero esta evidencia no acredita replay de efectos de React dev ni sesión real. En el caso401, Navigation API retiene **solo en el test** una intención/destino exactos; se comprueban retiro de controles, respuesta ticket tardía y `printCount=0` usando los globals del documento original. Después se suelta el destino capturado y se observa el documento restablecido. No se presenta como observación del documento viejo durante una navegación real.

## Smoke nativo real

Tras transferencia explícita de CI por coordinación, runner propio `node tools/pos-measurement/scope-client-smoke.mjs`:

1. `fixture setup`: wrapper `tools/neon-test.sh`, migraciones CI aplicadas; **1/1 PASS**. Crea dos negocios propios con sesiones reales mediante helper de producción internalAdapter; fixture `scope-client-0242`. No utiliza cookies ni datasets de M0.
2. `build`: Next webpack **EXIT0**, log `scope-client/build.log`; BUILD_ID **`cE0AIVAqRwZmMQ5K5Q_ER`**. `start`: proceso propio43242, log `scope-client/server.log`, sin preload/instrumentaciónM0.
3. `browser`: **EXIT0** contra build/start reales y CI. Entrada POS desde seed: **0GET sesión/módulos propios y1GET listado**, recursos POS con scope. Preparación real de borrador A; cambio explícito a cookie B; POST guardar con intención A responde **409 `backoffice_context_changed`**, una sola escritura intentada/sin retry; retiro y navegación documental `/backoffice`, borrador A ausente. `scope-client/native-browser.json` guarda método/ruta/presencia de scope, nunca scope/cookies/QR/cuerpos privados. CDP pausa únicamente entrega del **cuerpo real**409 para observar su código antes de que la navegación lo borre; no reemplaza ni fabrica respuesta.
4. `fixture inspect`: **1/1 PASS**, ambos negocios conservan snapshot de posOrders idéntico; `native-inspection.json` unchanged=true.
5. Se detuvo el servidor propio antes de `fixture cleanup`: **1/1 PASS**, se retiraron negocios y usuarios propios; `native-cleanup.json` removed=true. Puerto43242 sin listener; ningún proceso DB/server propio pendiente. CI liberable.

Setup/inspect/cleanup son operaciones separadas; setup usa escritura exclusiva del manifest y no sobreescribe evidencia anterior. El fixture privado permanece para auditoría con cookies ya asociadas a usuarios retirados. No se reutiliza como sesión activa de QA.

## Fallos observados y límites

- Chromium inicialmente no arrancó por sandbox MachPort Permission denied; la misma prueba ejecutó con escalación acotada. Git index.lock y kill del servidor propio también requirieron escalación; coordinación avisada de inmediato.
- Unit inicial usó scope sintético corto rechazado por el validador de cabecera; se corrigió el fixture a64hex. Dos casos nuevos de browser inicialmente tenían DTO catálogo incorrecto/lectura de lista retenida que deshabilitaba Nueva orden; corregidos los fixtures, sin cambiar producto para ocultar fallos.
- Regresión impresión original **2/3**, porque esperaba heading local tras401. La ampliación autorizada cambia esa expectativa a retiro documental; no elimina el caso ni reduce privacidad. Intentos de retener únicamente respuesta de navegación bloquearon locators/evaluate/CDP del documento provisional y dieron timeout; la prueba final retiene intención con Navigation API y declara ese límite.
- Primera captura nativa intentó leer body después de navegación y falló por Network.getResponseBody. Log preservado `native-browser.log`; la corrida final con observador de entrega real PASS en `native-browser-observed.log`. Los fallos de observación no son PASS ni campañas de medición.
- No verify global, DB producto, schema, contratos v2/peso, medición CP4, certificaciónM1 ni QA independiente. La entrega requiere QA nuevo sobre candidato congelado; conserva evidencia de build2c4ef9eb porque los cambios posteriores afectan solo tests/runner/teardown/documentación.
