# 0242 — Reanudación y fichas CP0

2026-10-18. Owner pidió retomar0242, revisar la decisión pendiente y continuar con dos implementadores y QA independiente. Base real `621951fc98f63e1e57b5166b93dd8ac9a911944d`, rama dev; producto previo `5f9cb2b2`. Esta preparación no cierra CP0 ni certifica producto.

## Decisión de entrada

Owner respondió explícitamente: «No aplican a productos por peso. Gratis ni 2x1». Spec/anexo/ADR/plan actualizados en0e413c94; QA focal independiente conforme. La restricción aplica a línea mass para gratis/2x1; las unit elegibles de órdenes mixtas y porcentaje/importe sobre peso se conservan. No se captura cantidad bonificada. La spec funcional está cerrada y el código CP0 autorizado bajo las reservas ampliadas de factory.

## Recursos y escritores

Tres worktrees preparados con `tools/worktree-new.sh`, Node24.20.0 y dependencias propias offline/frozen-lockfile, sin configuración DB heredada. El sandbox bloqueó inicialmente la ref Git; creación reejecutada con escalación autorizada. Checkout principal conserva rama dev y trabajo ajeno.

| TaskID / rol | Worktree y rama en /private/tmp/checkpass-pos-0242 | Reserva inicial exclusiva | Recurso |
| --- | --- | --- | --- |
| pos-data-0242 / A | pos-data-0242 | docs/factory/0242-cp0-data.md | doc:0242-cp0-data |
| pos-ui-0242 / B | pos-ui-0242 | docs/factory/0242-cp0-ui-m0.md | doc:0242-cp0-ui-m0 |
| pos-qa-0242 / QA | pos-qa-0242 | docs/factory/0242-cp0-qa.md | doc:0242-cp0-qa |

Coordinador único writer de spec/anexo/ADR/plan/estado e integración. Implementadores no subdelegan. Después de aceptar A/B documentales e integrarlos en89dc1707, factory continue amplió A a tipos puros de measures, resource-measurement, contracts y measure-contract.test, y B a harness/fixtures/login/preload/launcher/instrumentación en los paths explícitos del registro. B tiene db:ci-integration exclusivo incluido teardown, puerto43242 y harness:0242-pos-m0; A sin DB. No hay migración nueva ni kit asignados. La instrumentación opt-in del cliente DB está expresamente asignada a B para control y candidato; no cambia configuración global de driver/pool/auth.

## Contrato de esta entrega preparatoria

A entrega inventario schema/financial/eventos/catalog/business/consumidores, SQL expand propuesto sin ejecución, paths concretos y checks. B entrega inventario del circuito UI, harness existente, receta M0 real y paths de instrumentación propuestos. QA revisa hallazgos/contrato y matriz de aceptación en contexto independiente; revisará después entregas/candidato congelados, sin implementar producto.

Aceptación preparatoria: informes ligados a base real, paths comprobados, límites explícitos y ningún PASS de producto por lectura estática. Entregas propias limpias y commits de ámbito exclusivo; `factory deliver` por coordinador, revisión independiente antes de `accept`. No avanzar main por una preparación que aún no cierra CP0.

## Hallazgos incorporados al contrato

- `PosOrderV2.items` conserva nombre público actual, sin segunda lista lines.
- Capturas/tarifas hasta9decimales; gramos derivados de lb pueden requerir14. Cocientes no terminantes conservan racional exacto.
- Procedencia Recetas requiere racionales aditivos tanto para cantidad de insumo como de receta; columnas legacy6/3decimales son proyecciones. Constraints deben permitir proyección0 de un racional positivo sin inventar consumo.
- Peso no existe en control: diagnóstico/aceptación M1, sin A/B ficticio.
- Harness de componentes con API interceptada y Nextdev no acredita M0 ni smoke real. Seed de setup actual consulta sesión/módulos y no sirve para medir su eliminación.

El anexo congela firma pura ResourceMeasurementValidator<Tx> y política ModuleRoute.backofficeScope optional|required. A implementa solo tipos puros CP0; ensamblado/consumers se reservan en CP1.

## Cierre CP0 y siguiente paso

Preparación documental A ca15a01c y B86d0a682 aceptadas con QA42bf3422; informe integrado en dev. A puro329c7917 aceptado e integrado con QA7fc88bad:53/53 pruebas independientes sobre9d719476, sin skips/retries; helpers exactos/DTO/medidas/legacy y tipos puros del hook. Correcciones previas de selección2x1 y límites legacy preservadas, no se presentan como primer intento verde.

B LISTA c379c9a8 aceptada con QA80b32497 e integrada dev1f40112e:36muestras válidas(30recargas+6firstassets),888SQLstart/end0errores. Fuente build6f8e1e9c y runnersf33/647 con hashes compatibles; fallos anteriores3inválidos+1incompleto de normal y smokeChromium0intentos preservados. Archivo control y265hashes/config/schema/RAW auditados. Es referencia descriptiva, no M1 ni CP0 global.

Owner pidió contexto limpio por entrega. Nuevos autor/QA terminaron flujos8dca14ee/QA9ee475dc:18/18 campaña y3/3smokes,2856SQLpares0errores,21cierres durables únicos inspeccionados. Combinación congelada a5cbd20c PASS con53pruebas puras+2instrumentales y tipos merchant. **SalidaCP0 aceptada e integrada en dev; CP1 habilitado.** Fuente campaña29b/build6f; fallos iniciales UI/inspector preservados, sin repetir ventas para corregir oráculo. Límites y18GETtail sin finish en handoff/QA; M1 observará esa cola fuera del reloj. Recetas desactivadas/wallet suprimido/cross sin origen no certifican entrega física. M0 descriptivo, no V2/M1. Procesos propios detenidos,0CWD/0listeners43242/43243; CI/config/cookies/RAW/control intactos.

Siguientes fichas pequeñas preparadas: [financial puro](0242-cp1a-financial.md) y [scope servidor](0242-cp1a-scope-server.md), con nuevos agentes tras aceptar M0. Cliente/seed/cache será otra entrega/contexto, sin acumular todo auth/transporte en un worker.

CI remoto consultado sigue ROJO en `90ebe18f` (verify Unit + integración Neon); no reparado por esta tarea. No push ni PROD. La preparación documental inicial no ejecutó producto; los checks/campañas posteriores se atribuyen a sus entregas y entornos arriba, sin reutilizar PASS de0238 para0242.
