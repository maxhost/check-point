# 0242 CP2b.4 — QA independiente de listado

**PASS de entrega y combinación focal**, sin hallazgos bloqueantes. Candidato congelado final `e87ddebb0f8b0bd7f2604853a698015689173dae`, con entrega autor `2548c4540e52cb4e092506c05a6116435b800ff3`, producto `f62609ef8f8ac00ea5e0f0f5b7e4d0ce0d58f4fa` y revisión de tests `3d0a9ce23f2ba35c0acb93e19d9f0c45409f6fbe`. QA nuevo, sin implementar producto ni subdelegar. Base de revisión del autor `aa58db729da8f25b7f4f2448c36955d1314ce89a`; leído contrato0242 §3, ficha, performance y handoff final.

El primer congelado QA `c3363aca91f7cc1fb664f66b68638d01126d9f50` ya incluía lectores aceptados sobre dev y revisión final del autor. Se verificó ausencia de delta en `apps`, `packages` y lockfile hasta e87ddebb: solo se adjuntaron handoff y ficha documental. Los checks independientes sobre c336 conservan identidad para el candidato final.

## Revisión observada

- SQL agrega originales racionales por orden mediante SUM NUMERIC entero escalado, máximo, flags y contadores. Los coeficientes y denominador común derivan de ratios/gramsFactor aceptados; `trunc` valida escala/integralidad. No hay división NUMERIC, redondeo monetario SQL, constantes de conversión duplicadas, arrays de líneas ni N+1. Tres SELECT constantes; no se selecciona el JSON completo de settlement. La normalización/rango usa núcleo común y BigInt, sin pasar importes por Number.
- Abiertas usan moneda vigente y originales, sin autoridad de totalSnapshot ni doble redondeo. Cerradas V2 priorizan collected congelado aun sin cliente; fallback core enlazado, snapshot explícito o originales legacy compatibles. Anuladas conservan bruto y saleTotal null. V1 mantiene centavos históricos, cantidades representables y neto core anterior, incluso COP original0.98 frente settlement1. Validación antes de Number; errores seguros para metadata, incompatibilidad y rango.
- Overload/default V1 sigue vigente; V2 requiere cuarto argumento2. El caller real en routes.ts sigue usando tres argumentos. Shape V2 incluye version/saleType/orderLabel/lineCount; fallback de mesa depende del FK, no del texto. Sin cambios a escritura/esquema/barreras ni truncamiento/paginación de abiertas.
- Evidencia DB cubre abiertas vacías/antiguas y orden, aislamiento de negocio, snapshots con producto borrado, neto sin cliente real, moneda actual/congelada, legado y anulación sin ingreso, día local/DST y límites90d; volumen200 órdenes×30 líneas sin perder abiertas. Revisión de query confirma agregación escalar; volumen no certifica latencia.

## Evidencia ligada a revisión

Node24.20.0 y pnpm11.4.0. Logs completos privados en `/private/tmp/checkpass-pos-0242/pos-list-logs/`; no se copian identificadores ni datos de fixtures al informe.

| Señal | Identidad y resultado |
| --- | --- |
| Reproducción QA de puros | `qa-pure-c3363aca.log`: 9 PASS, 0 FAIL, 0 SKIP; equivalencia con financial, pares g/kg/lb, precisión9, mezcla, límites, V1/V2 y0.499 sin doble redondeo |
| Tipos merchant integrado QA | `qa-types-c3363aca.log`: EXIT0 sobre combinación congelada |
| Nueva suite SQL/dominio | `neon-f62609ef.log`: 5 PASS, 0 SKIP |
| Regresión inicial legacy | Mismo log: 7 PASS y 1 FAIL por expectativa8.00 frente storage8.000000000; wrapper EXIT1 preservado |
| Caso corregido y teardown final | `neon-case11-teardown-3d0a9ce2.log`: CASO11 1 PASS y afterAll propio completado, 7 casos filtrados, EXIT0 |
| Limpieza anterior acotada | `owner-cleanup-3d0a9ce2.log`: 1 PASS, EXIT0; mismatch revierte antes de DELETE, identidad exacta revalidada y usuarios/sesiones0 tras commit |
| Estáticos autor reutilizados | `final-static-3d0a9ce2.log`: lint/formato/diff EXIT0; tipos domain/db90d0dad4 compatibles sin cambios de paquetes; UIguard75a38447 EXIT0 sin aumentos |
| Guardias previas separadas | `module-boundaries-90d0dad4.log`: 24 PASS / 2 FAIL, EXIT1; backlog exacto siguiente |

No se atribuye PASS global al wrapper inicial ni se cuentan siete filtrados como aprobaciones nuevas. La composición válida es nueva5 y legacy7 del candidato f626 más caso11 corregido y teardown de3d0a9ce2. El cambio de expectativa conserva comparación exacta a escala9 y las demás aserciones; la ampliación afterAll solo borra/verifica IDs del world propio. Producto final idéntico a f626. Desde75a38447 a f626 solo la suite Neon agregó dos umbrales0.005/0.5; estos sí fueron ejecutados en f626.

Backlog guardias: expenses/server/immediate.neon.integration.test.ts importa stock/count.ts; literales extra en backoffice-context-controller.test.ts(3), backoffice-context-refresh.test.ts(1), onboarding/checklist-context-resource.test.ts(1), analytics/evaluation/policy-simulation.test.ts(2), analytics/lifecycle/index.ts(1). Ningún nuevo ofensor del listado; guardias intactas. Este PASS focal no declara verify global verde.

## Límites y cierre

SQL mass sobre VALUES valida álgebra/oráculo y errores sin insertar masa canónica ni retirar barreras; no certifica activaciónCP2c. Comparaciones puras gross/net y voided con settlement son defensivas sintéticas. Las pruebas directas de listado no certifican guard/scope HTTPV2 ni GETordersV2 conectado: corresponden al ensamblado posterior. Falta consumer-role URL en wrapper, pero ese oráculo no está en estas suites ni se certifica. Sin M0/M1 ni promesa de rendimiento temporal.

QA no abrió DB/env/wrapper, servidores ni procesos persistentes; solo reprodujo puros y tipos y reutilizó evidencia compatible inspeccionada. Sin cambios de producto, refs principales, estados comunes, push o PROD. Este informe es el único archivo escrito por QA. Factory, aceptación e integración quedan a cargo del coordinador.
