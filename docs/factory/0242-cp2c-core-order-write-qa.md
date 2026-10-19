# 0242 CP2c.1 — QA independiente del writer core medido

Veredicto: **PASS**, acotado a la entrada interna y sus garantías de persistencia. Sin hallazgos pendientes. QA en contexto nuevo, sin modificar producto/tests ni ejecutar DB propia.

## Identidad y alcance

- Autor entregado: `5eb2d6476bd148264066ef1567560daef6e82d07`; implementación y suite CI probadas en `61f7e2ff8a0fb40e5965b1e28e08ba7eca577692`. El delta final es solo handoff.
- Candidato combinado revisado: `bd238fd43662a8fca61ab38eabba96ce9198eb04`, sobre creación V2 aceptada `a96397ab`. Los checks propios se ejecutaron en `50d4587f0b579fcb7f6ee50a42e5fc9f16ad0c00`; comparar ambas revisiones confirma delta exclusivamente documental y producto/tests idénticos a `61f7e2ff`.
- Worktree QA: `/private/tmp/checkpass-pos-0242/pos-qa-0242`. Node `24.20.0`, pnpm `11.4.0`; lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`, coincidente con evidencia del autor.
- Revisados ficha CP2c.1, contrato0242 §1/4/5, diff completo y helpers financieros/medidas pertinentes. Solo cambian los cuatro archivos de código/tests reservados y handoff; no hay cambios HTTP/close/cupón/esquema/activación ni imports de módulos opcionales en core.

## Invariantes observadas

`persistMeasuredGrant` valida primero el settlement autoritativo existente, moneda/neto, cardinalidad y biyección de referencias opacas (el mapa consume cada referencia una sola vez), bruto asignado y bruto racional exacto. No reconstruye tarifa desde dinero normalizado. Devuelve copias de líneas con medida validada e inmutable; no modifica items, settlement ni sus originales. Cantidad/tarifa siguen strings sin conversión a Number. La ruta trusted unit conserva límites históricos; mass usa límites nuevos.

Ambas entradas comparten la misma sentencia y sus efectos: bump, orden neta, líneas brutas con cuatro metadatos, visita/proyección, evento/delivery y push. Legacy conserva firma y conversión unit previa. No hay segunda contabilidad, efecto externo posterior ni FK de sourceLineId. El retry serial devuelve null; la carrera conserva el aborto23505 sin ON CONFLICT que pudiera retener un segundo bump. La responsabilidad de autorización/tenant, fuente bloqueada, pagos y unidades decididas sigue en el productor.

## Evidencia propia y reutilizada

Checks propios con `source ~/.nvm/nvm.sh && nvm use`:

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/counter/measured-order-input.test.ts`: **24/24 PASS**, cero skips, EXIT0. Cubre precisión9dec, equivalencia kg/lb/g, JPY/USD, bruto/neto, extremos unit legacy, incoherencia/duplicados y misma sentencia legacy/medida. Log privado `/private/tmp/checkpass-pos-0242/cp2c-qa-pure.log`.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: **EXIT0**, sobre combinación con create aceptado. Log privado `/private/tmp/checkpass-pos-0242/cp2c-qa-types.log`.
- `git diff a96397ab HEAD --check`: limpio. Comparación de código/tests entre autor probado y candidato final: sin diferencias.

Evidencia del autor inspeccionada en `/private/tmp/checkpass-pos-0242/core-order-measured-evidence/`, ligada por manifiestos/SHAs/comandos/exits, sin abrir env ni usar la DB reservada:

- `tools/neon-test.sh --app merchant src/modules/pos/server/measured-core-order.neon.integration.test.ts --no-file-parallelism` en `61f7e2ff`: **6/6 PASS, cero skips, EXIT0**, incluido teardown. Unit canónico comprueba originales/metadatos/neto/units/balance/push/proyección/createdAt, replay y legacy; última FK inválida revierte el snapshot completo; metadata inválida no produce efectos; barreras canónicas rechazan mass/tarifa precisa. Carrera real observa dos writers esperando el lock, exige un ganador y perdedor23505, y una sola orden/línea/acreditación/push/evento/delivery. Otro tenant queda sin filas; esto no demuestra auth HTTP.
- Primera CI en `f2cd3253`: **FAIL de beforeAll**, programa fixture points/per_purchase rechazado por constraint; **6 skipped, cero casos ejecutados**, sin validación de producto. Fix posterior solo cambia fixture a points/per_amount, bloque1.00, y handoff; no relaja assertions ni barreras. `recovery.log`: **1/1 PASS, EXIT0**, recuperación acotada por IDs exactos tras verificar identidad/ausencia de vínculos ajenos, business/owner/sesiones0; no limpieza por prefijo genérico. El teardown final verifica negocios, membresías, owners, sesiones, consumidores y pushes propios ausentes.
- Tipos merchant repetidos tras fix; tipos consumer/platform, lint focal, formato, UIguard y frontera **4/4** compatibles, con logs EXIT0. Producto invariable desde `f2cd3253`; fixture lint/formato repetidos en `61f7e2ff`. Aviso de variable del rol consumer ausente: ese oráculo no se ejecutó ni se afirma validado.

## Límites y cierre

Mass/precisión se prueban en álgebra y serialización VALUES; eso no es escritura canónica habilitada. Constraints/triggers vigentes siguen activos. No acredita auth/tenant de API, selección de cupón, cierre conectado/E2E, V4 ni activación de venta medida. Sin browser/build/M0/M1/fullverify/PROD/push/túnel. QA de combinación aquí cubre identidad del producto y tipos merchant con create aceptado; no recertifica flujos ajenos.

Antes de adjuntar el handoff final: cero checks activos, worktree limpio y comprobación ps escalada sin procesos propios restantes. La consulta ps inicial fue bloqueada por sandbox y luego completó con permiso; no fue fallo de producto. Logs privados fuera del worktree, sin reproducir IDs/PII en este informe. Integración y factory quedan al coordinador.
