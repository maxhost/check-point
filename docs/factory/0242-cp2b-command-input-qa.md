# 0242 CP2b.2 — QA independiente de entrada e intención

Veredicto: **PASS del alcance puro CP2b.2**, sin hallazgos de producto. Candidato congelado `cf83d05cc9c8eabcbf88785a78dfb5b62af89c15`, base de combinación `5222047f`, entrega `39aab82beacc9c64c6c1618b3e5e0167462f3d54`, código `ca87073000712156d0a251354efff0e3e63f065c`. WT/rama propios `/private/tmp/checkpass-pos-0242/pos-qa-0242` / `pos-qa-0242`. QA nuevo, sin subdelegación ni modificación de producto/tests.

Se leyeron AGENTS, protocolos ADR0144, ficha completa, contrato0242 §1/3, contratos POS, medidas y handoff. El delta desde dev contiene únicamente seis helpers/tests y handoff. Los seis archivos coinciden con código congelado del autor; lockfile sin cambios. La diferencia de candidato respecto al SHA autor incluye0106 ya aceptada y documentos; este informe no recertifica almacenamiento ni su migración.

## Observado

- Create/update validan estructura, versión INT32, cuatro tipos nuevos, legacy solo mediante contexto separado de servicio, etiquetas aplicables, UUID/referencias, nota, lista explícita vacía/200 y rechazo201. Counter/mesa real eliminan autoridad de la etiqueta manual; referencia local/mesa permanece sin lookup.
- Líneas nuevas usan captura estricta string hasta9decimales y revisión string positiva INT32; rechazan precio/nombre/medida/importes del cliente. Existentes prohíben revisión nueva, mantienen identidad individual y rechazan lineId duplicado normalizado; no fusionan productos iguales.
- La sintaxis de existentes es provisional. `resolveExistingMeasuredLine` exige fuente separada, identidad de línea/producto coincidente y dimensión compatible; preserva nombre, tarifa, priceUnit y conversionVersion. Cantidad unit histórica hastaINT32 solo conserva excepción ante coincidencia canónica exacta con snapshot confiable. Nuevas/cambiadas mantienen límite estricto. Cambio compatible de captura mass conserva tarifa/factor, sin mutar fuente.
- Huella SHA256 usa estructura explícita estable y todos los campos semánticos normalizados; incluye posiciones/cardinalidad/revisión/unidad, conserva separación de productos iguales, ignora etiquetas sin autoridad y createRequestId (clave separada). No consulta catálogo/DB ni muta input. El digest no es credencial.

## Evidencia

Node24.20.0, pnpm11.4.0, Vitest4.0.18, dependencias propias; sin instalación, DB/env/wrapper. Logs/config/test independiente fueraWT: `/private/tmp/checkpass-pos-0242/pos-qa-logs/`.

| Comprobación | Resultado |
| --- | --- |
| `pure.log`: tres suites originales ejecutadas en cf83d05 | 72PASS,0FAIL,0SKIP, EXIT0 |
| `independent.log`: harness externo, sin setupDB, en cf83d05 | 5PASS,0FAIL,0SKIP, EXIT0 |
| Señales independientes | Cantidad histórica exacta frente a fuente ausente/ajena/distinta y dimensión; alta nueva rechazada; captura mass conserva tarifa/factor en fuente congelada; body no autoriza legacy/snapshot; SHA256 contrastado con oráculo explícito y entrada congelada; límites mass9dec |
| Evidencia autor reutilizada | Lint/formato seis archivos y UIguard PASS en ca870730; domain tipos PASS en0596bc24, sin delta domain; merchant tipos original PASS ca870730 |
| Guardias autor, evidencia compatible revisada | 24PASS/2FAIL, EXIT1; backlog exacto sin nuevos ofensores en delta, no PASS global |
| `types-merchant.log`: typecheck sobre candidato integrado cf83d05 | PASS, EXIT0 |
| `git diff --check` | EXIT0 |

Backlog de guardias: import expenses/server/immediate.neon.integration.test.ts → stock/count.ts; literales core adicionales en backoffice-context-controller.test.ts(3), backoffice-context-refresh.test.ts(1), onboarding/checklist-context-resource.test.ts(1), analytics/evaluation/policy-simulation.test.ts(2), analytics/lifecycle/index.ts(1). No se tocaron guardias ni fixtures para ocultar fallos. Tipos DB originales son evidencia de entrega, no se presentan como comprobación del esquema integrado0106.

Primer arranque del harness QA falló por ruta absoluta incorrecta de `vitest/config` (setup, cero tests); conservado en `independent-setup-failed.log`. Configuración externa corregida a dist/config.js; la corrida posterior ejecutó los cinco casos completos. Typecheck inicial fallido del autor en0596bc24 también sigue documentado en su handoff; corrección exclusiva de anotación de retorno verificada en diff.

## Límites y cierre

Los tipos Trusted son contratos de origen del caller, no una prueba criptográfica/nominal ni autorización de body. El futuro servicio debe obtener contexto/filas de su orden bloqueada y resolver CADA existente; un resultado de parseo no es un snapshot validado. No hay caller conectado que confunda ambas fases en este candidato. Tampoco se detecta una aproximación presentada deliberadamente como nueva captura: la UI debe preservar la fuente cuando solo cambia presentación.

No se verifican guard/scope/tenant/locks, catálogo actual, replayDB/idempotencia transaccional, dinero ni API/UI real. Serán gates de la siguiente entrega. Sin DB/env/wrapper, browser/build/fullverify/M0/M1/servidor3201/túnel/demo/push/PROD. Sin modificaciones a financial/medidas/legacyV1. Factory/aceptación/integración corresponden al coordinador.

`ps` ordinario dio EPERM del sandbox, avisado al coordinador de inmediato; lectura escalada autorizada mostró solo comandos transitorios de inspección, sin procesos persistentes propios. Hooks `.githooks`, sin bypass. Único archivo versionado de QA: este informe.
