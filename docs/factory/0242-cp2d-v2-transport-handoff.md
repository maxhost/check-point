# 0242 — CP2d.2 transporte V2: entrega

Base `8770048c3c954504185b1661c525119fc9541572`; código y tests `885f7630813ac0d01910178311d47ff1324e017a`. WT `/private/tmp/checkpass-pos-0242/pos-v2-transport-0242`, ref `pos-v2-transport-0242`. El commit que añade este handoff solo contiene documentación. SHA final y hashes de evidencia en `/private/tmp/checkpass-pos-0242/v2-transport-evidence/identity.json`. Sin push/PROD ni cambios de refs principales/factory/índices/estados.

## API y contrato

Propuesta comunicada a coordinación antes del código: `createPosClient(read, options?: PosClientOptions)` y `usePosContext(options?: PosClientOptions)`, con `PosClientOptions = Readonly<{ contractVersion?: 1 | 2 }>`. Ausente/1 mantiene V1 sin header adicional y conserva la forma anterior de fetch. V2 incorpora `X-Pos-Contract: 2` solo desde el módulo, usando el mismo `posRequest → panelRequest → fetch`. El hook memoiza el cliente por versión primitiva: un cliente nuevo no modifica capturas anteriores.

`capture()` copia identidad/scope/retire y versión antes de devolver el transporte de la intención. Cambiar luego el objeto de opciones/contexto no modifica una captura previa. La captura permanece utilizable para reintentos explícitos dentro de la misma identidad; otra identidad bloquea antes de red. El transporte no congela UUID/cuerpo del caller: esa obligación sigue siendo del futuro consumidor del intento incierto. No añade retries, GET sesión/módulos ni otro fetch.

`BackofficeRequestOptions` incorpora `headers?: HeadersInit`, opción genérica sin nombres/reglas POS en core ni sus tests. Solo al usar esa opción se copia a `Headers`; el scope validado se aplica al final con `set`, sobrescribiendo cualquier variante case-insensitive y eliminando joins/duplicados de ese nombre. La copia no muta los headers del caller y ocurre antes del await. JSON impone `content-type: application/json`; FormData elimina ese header adicional para que fetch produzca su boundary. Signal/no-store y la rama legacy sin headers nuevos conservan su comportamiento.

`PosError` añade `payload: Record<string, unknown>` como último argumento opcional (default `{}`). La conversión desde `PanelRequestError` conserva el payload entero sin transformar strings/cantidades/precios ni descartar metadata. Constructor y propiedades legacy `order/openCount/status/code` siguen disponibles. Para DTO V2 el consumidor debe usar/narrowear `payload`: la propiedad `order` mantiene su tipo legacy por compatibilidad, sin inventar una proyección numérica de V2.

401 y scope409 actuales pasan al retiro documental existente una vez por respuesta. Resultados/rechazos tardíos de A se descartan antes de retirar B. 402/403/conflictos/upgrade requerido preservan clasificación y datos sin retry ni downgrade. El header de contrato lo genera la opción tipada; la prueba de rechazo contractual comprueba `409 pos_client_upgrade_required`, el código real del selector de servidor, y ausencia de fallback.

## Archivos

Los seis archivos fuente/test exactos reservados más este handoff: `backoffice-scope-request.ts`, `panel-request.ts`, `panel-request.test.ts`, `pos-types.ts`, `pos-context.tsx`, `pos-context.test.ts`. Sin UI nueva, cache/editor/consola/pagos/impresión/backend/schema/kit/tooling/deps. Sin ampliaciones de scope.

## Evidencia

Node `v24.20.0`, pnpm `11.4.0`; comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use`. Logs completos y exits fuera del WT en `/private/tmp/checkpass-pos-0242/v2-transport-evidence/`. `identity.json` liga base/código, hashes SHA256 de seis fuentes/config/lockfile, comandos, logs y resultados. No carga de env, DB ni servidores. Setup Vitest merchant fija `AI_PROVIDER=fake` y retira la clave de IA del proceso de test, según configuración existente.

- `pnpm exec vitest run apps/merchant/src/app/backoffice/panel-request.test.ts apps/merchant/src/modules/pos/ui/pos-context.test.ts apps/merchant/src/modules/pos/ui/pos-cache.test.ts tools/app-boundary.test.ts`: **46/46 PASS**, cuatro archivos, cero fallos/skips/retries (`tests-final.log`, EXIT0). Panel13, contexto26, cache3 y boundary4. Primera corrida44/44 conservada en `tests.log`; se agregaron después dos regresiones explícitas de cliente sin provider y error legacy, sin cambiar producto.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS**, EXIT0 (`types-final.log`). Primera corrida también EXIT0, repetida tras añadir tests.
- ESLint focal de los seis archivos, Prettier focal y `git diff --check`: **PASS**, EXIT0 (`static-final.log`). La identidad registra los comandos completos.
- `node tools/ui-guard.ts --base 8770048c3c954504185b1661c525119fc9541572`: **PASS**, cuatro archivos contados, sin aumentos (`guard.log`, EXIT0). Advertencia de Node existente `MODULE_TYPELESS_PACKAGE_JSON`, sin modificar tooling para ocultarla.

Casos decisivos: legacy sin opción conserva shape; opt-in1/2, JSON/body decimal idéntico; captura/retry conserva versión y scope aun mutando sus objetos; cambio A→B bloquea retry antes de fetch; respuestas tardías200/401/403/409 no retiran B; retiro actual401/scope409, restricciones402/403/conflicto y upgrade sin retry ni downgrade; products[]/orden V2/metadata exactos y error legacy con cantidad numérica; headers object/Headers/tuples y scope alterno de distinto casing repetido; headers copiados antes de await; FormData/JSON/signal/no-store; scope malformado sigue sin llegar a red.

Los tests conservan transporte real hasta fetch mocked. No acreditan auth nativa, autorización del servidor, DB ni navegación documental real nueva. Se referencia la evidencia previa aceptada en `0242-cp1a-scope-client-handoff.md` para HTTP/scope nativo; no se reejecutó ni se presenta como una certificación nueva de este SHA. Sin browser/build/fullverify/M0/M1. QA de entrega nuevo y combinación real quedan a coordinación.

## Fallos, procesos y siguiente paso

Ningún fallo de producto/check, skip o retry. No sandbox/gitdir/psEPERM ni escalaciones durante esta entrega. Primera observación lsof incluía al propio observador lsof; `processes-final.json` excluye registrador/shell/lsof y contiene cero procesos con cwd en el WT. No se iniciaron servidores/procesos persistentes. El log inicial de observación se conserva como tal, sin confundirlo con un proceso pendiente.

Autor conserva WT/ref y fixes hasta aceptación; no cleanup anticipado. Entrega limpia, candidato congelado para QA independiente. Factory deliver/accept/integración pertenecen al coordinador.
