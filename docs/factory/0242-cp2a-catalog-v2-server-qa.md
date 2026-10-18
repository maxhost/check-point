# 0242 CP2a.5 — QA independiente catálogo v2 servidor

Veredicto: **PASS del alcance CP2a.5**, con las barreras y límites siguientes. No es aprobación de publicación ni de CP2c. QA nuevo, sin subdelegación ni implementación de producto.

## Identidad y entorno

- Base de integración aceptada: `be6ffb59`; candidato temprano `31e1e7781c34dc17c4859541ec22ddfb24df24bc`, refrescos `bbbe719030272bad2e881d544c6a9b2d8eb48311` y candidato final comprobado limpio `82cf1fa7fac07b24c828bd53a89e61610003304a`.
- Entrega autor `ffbcf8d14a392896b8b8321ea567da9eea98b131`; código autor `68030da912c86a51ae5721b9bd5057aebe88f6cc`. Diff entre ese código y candidato final vacío en todos los paths de catálogo/contratos/suites/lockRecipes de la entrega. La diferencia de base del autor incluye UI de unidades ya aceptada, ajena a este QA.
- Worktree/rama QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`. Único archivo modificado: este informe. Node `24.20.0`, pnpm `11.4.0`; dependencias propias y lockfile sin cambios.
- QA exclusivamente offline: ninguna DB/env privado/DDL/wrapper operado por QA. Evidencia CI del autor inspeccionada, rama CI protegida vía `tools/neon-test.sh --no-file-parallelism`, configuración seleccionada `/private/tmp/checkpass-pos-0242/private/ci.env`. Aviso consumer role sin configurar: ese rol no se certifica.

## Revisión y aceptación observadas

DTOv1 conserva la proyección pública histórica, elimina objectKey y comprueba compatibilidad unit/centavos/rango antes de Number. DTOv2 expone strings/null, medidas y revisión sin claves privadas. Los helpers comunes conservan el histórico unit alto exacto al editar nombre; una tarifa alta diferente o trasladada a mass falla. Parser nuevo mantiene nueve decimales, límite, rechazo de exponentes/números y tipos estrictos.

PUT compara expectedSalesRevision contra la fila relecta y bloqueada dentro de la transacción, tras business-config; el conflicto incluye solo producto autorizado del negocio. Creación1, delta comercial, no-op normalizado, imagen/categoría y carrera de dos PUT se verificaron. Guard catalog sin email, tenant404 y DELETE owner-only permanecen. Éxito y errores adoptados son private,no-store; DELETE header2 también lo aplica tras corrección.

Merchant inyecta el callback genérico; domain no incorpora nombres/imports de módulo. Callback recibe la misma tx/contexto incluso old==new; rechazo y excepción revierten producto/revisión/locales y escrituras del proveedor. Proveedor real con base capturada incompatible sobre producto unit rechaza sin cambiar snapshots. Auditoría de saveComposition→publishResolution, writeRecipe→fanoutRecipe y cutoverR1 confirma paso por lockRecipes, ahora business-config antes de recipes-r1. Test real observa espera de catálogo/config/publicación y disponibilidad del mutex proveedor mientras business-config está retenido.

Constraints temporales0102/0103/0105 y producer4 permanecen sin cambios. Intentos mass/precisión reales devuelven409 pos_client_upgrade_required y conservan estado/revisión. Traducción limitada a SQLSTATE23514 y tres constraints temporales nombradas; otros errores se propagan. No se inventa base ni se debilitan fixtures/DB.

## Evidencia y reutilización

Logs QA: `/private/tmp/checkpass-pos-0242/catalog-v2-qa-logs/`; logs autor: `/private/tmp/checkpass-pos-0242/catalog-v2-server-logs/`. Cada log citado conserva SHA/comando/salida/exit. Las suites CI llaman rutas Next con Request/cookie/guards/DB reales; no servidor HTTP desplegado.

| Evidencia | SHA | Resultado observado |
| --- | --- | --- |
| QA `pure-82cf1fa7.log` | candidato final82cf1fa7 | 5 casos del autor + reproducción independiente array: **6PASS/0SKIP, EXIT0**; configuración externa explícita `pure.config.mjs` |
| QA `pure-bbbe7190.log` | bbbe7190 | 6PASS/0SKIP, EXIT0 tras corregir parser |
| QA `type-domain-31e1e778.log`, `lint-source-31e1e778.log` | 31e1e778 | Domain tipos y lint9fuentes PASS, EXIT0; posteriores deltas cubiertos por autor |
| Autor `ci-68030da9.log` | código final68030da9 | **POS9PASS/0SKIP, EXIT0**, incluyendo DELETE/cache y proveedor503 |
| Autor `ci-a12ed237.log` | a12ed237 | Recipes2PASS reutilizados; total10PASS/1FAIL/0SKIP, EXIT1 por cachéDELETE posteriormente corregida. Recipes no consume DELETE; revisión del delta confirma compatibilidad |
| Autor `ci-882d0831.log` | 882d0831 | Regresiones revisión6, catálogo7 y sin-email6 PASS. Total21PASS/1FAIL/8SKIP y beforeAll fallido, EXIT1; no aprobación de esa corrida |
| Autor `types-a12ed237.log`, `merchant-68030da9.log` | a12ed237 / 68030da9 | Domain/db/merchant tipos PASS; merchant repetido para delta final, EXIT0 |
| Autor lint/formato/diff focales + deltas del handoff | 882d0831 / a12ed237 / 68030da9 | PASS; `git diff --check be6ffb59..82cf1fa7` QA también EXIT0 |
| Autor `guards-a12ed237.log` | a12ed237 | 24PASS/2FAIL, EXIT1: backlog expenses→stock/count y cinco paths core con literales. Sin nuevos offenders ni guardias editadas; delta final solo envoltura cache |
| Autor `ui-guard-882d0831.log` | 882d0831 | PASS sin aumentos; sin UI nueva en esta entrega |
| Autor `cleanup-a12ed237-fixed.log` | a12ed237 | Orphan exacto retirado vía wrapper, ausencia user/session/membership afirmada:1PASS, EXIT0 |
| QA `processes-82cf1fa7.log` | candidato final82cf1fa7 | Inspección read-only:0procesos propios persistentes, EXIT0 |

No existe una corrida integral nueva completamente verde: esta aceptación combina evidencia compatible y repetición de los casos afectados. Puros domain requieren invocación explícita con config externa preservada; no se afirma que la selección normal de proyectos los descubra.

## Hallazgos resueltos y límites

1. QA reprodujo coerción de `pricingUnit:["kg"]` por String: `pure-31e1e778.log`, 5PASS/1FAIL, EXIT1. No bypass de escritura observado: assertMeasureUnit rechazaba después. Corregido con typeof string y negativos array/objeto; reproducción final PASS.
2. QA identificó falta de caché en éxito/error DELETEheader2; CIa12 confirmó fallo. Corregido sin relajar aserción; POS9 final PASS.
3. CI inicial falló por staff sin permisos y503 fuera describe; corregidos permiso válido business y montaje. Ocho skips iniciales no cuentan como PASS. Orphan de fixture limpiado por ID exacto; primer cleanup falló por schema incorrecto antes de DELETE, segundo exitoso preservado. Fallos exploratorios de lint/formato y fronteras permanecen documentados en handoff.

Teardown de suites finales comprueba ausencia de negocios/usuarios/sesiones, sin error de teardown; no servidores/túneles propios. ps ordinario estuvo bloqueado por sandbox; inspección read-only escalada confirmó0procesos. QA no opera la CI transferida a composición. Sin cambios de producto/tests/guardias por QA, push, PROD, browser, build, fullverify ni M0/M1 de entrega.

Pendiente CP2c: habilitar escrituras mass/precisión, unidad en uso y carreras reales mass/config al retirar barreras. Este PASS certifica preparación/compatibilidad y rechazo seguro transitorio, no esos gates futuros. Backlog de guardias continúa abierto y separado del alcance.
