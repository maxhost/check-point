# 0242 — Reanudación y fichas CP0

2026-10-18. Owner pidió retomar0242, revisar la decisión pendiente y continuar con dos implementadores y QA independiente. Base real `621951fc98f63e1e57b5166b93dd8ac9a911944d`, rama dev; producto previo `5f9cb2b2`. Esta preparación no cierra CP0 ni certifica producto.

## Decisión de entrada

Sigue pendiente la cantidad bonificada en gratis/2x1 de masa. Se volvió a consultar al owner con las tres opciones originales: captura del operador, una unidad tarifaria o diferir esos beneficios sobre masa. No hay respuesta autorizada al preparar estas fichas. No implementar cálculo ni inferir consentimiento por la petición general de continuar. La regla de spec funcional cerrada mantiene el código de producto pendiente; el equipo avanza inventario, receta y revisión documental independientes.

## Recursos y escritores

Tres worktrees preparados con `tools/worktree-new.sh`, Node24.20.0 y dependencias propias offline/frozen-lockfile, sin configuración DB heredada. El sandbox bloqueó inicialmente la ref Git; creación reejecutada con escalación autorizada. Checkout principal conserva rama dev y trabajo ajeno.

| TaskID / rol | Worktree y rama en /private/tmp/checkpass-pos-0242 | Reserva inicial exclusiva | Recurso |
| --- | --- | --- | --- |
| pos-data-0242 / A | pos-data-0242 | docs/factory/0242-cp0-data.md | doc:0242-cp0-data |
| pos-ui-0242 / B | pos-ui-0242 | docs/factory/0242-cp0-ui-m0.md | doc:0242-cp0-ui-m0 |
| pos-qa-0242 / QA | pos-qa-0242 | docs/factory/0242-cp0-qa.md | doc:0242-cp0-qa |

Coordinador único writer de spec/anexo/ADR/plan/estado e integración. Implementadores no subdelegan. No hay DB, puerto, migración o fichero de producto asignados todavía. La reserva documental no autoriza editar los paths propuestos para código en los informes.

## Contrato de esta entrega preparatoria

A entrega inventario schema/financial/eventos/catalog/business/consumidores, SQL expand propuesto sin ejecución, paths concretos y checks. B entrega inventario del circuito UI, harness existente, receta M0 real y paths de instrumentación propuestos. QA revisa hallazgos/contrato y matriz de aceptación en contexto independiente; revisará después entregas/candidato congelados, sin implementar producto.

Aceptación preparatoria: informes ligados a base real, paths comprobados, límites explícitos y ningún PASS de producto por lectura estática. Entregas propias limpias y commits de ámbito exclusivo; `factory deliver` por coordinador, revisión independiente antes de `accept`. No avanzar main por una preparación que aún no cierra CP0.

## Hallazgos incorporados al contrato

- `PosOrderV2.items` conserva nombre público actual, sin segunda lista lines.
- Capturas/tarifas hasta9decimales; gramos derivados de lb pueden requerir14. Cocientes no terminantes conservan racional exacto.
- Procedencia Recetas requiere racionales aditivos tanto para cantidad de insumo como de receta; columnas legacy6/3decimales son proyecciones. Constraints deben permitir proyección0 de un racional positivo sin inventar consumo.
- Peso no existe en control: diagnóstico/aceptación M1, sin A/B ficticio.
- Harness de componentes con API interceptada y Nextdev no acredita M0 ni smoke real. Seed de setup actual consulta sesión/módulos y no sirve para medir su eliminación.

El hook genérico de cambio de medida y política de rutas aún requieren firma ejecutable/ensamblado y escritor explícitos antes de consumers; no se declara cerrado por estos ajustes documentales.

## Gates restantes y siguiente paso

Tras respuesta monetaria: coordinador sustituye propuestas pendientes en spec/anexo y solicita revisión QA focal. Congelar spec cerrada; extender reservas/fichas para tipos puros, DTOv2/hook y harness/instrumentación; reservar CI y teardown antes de cualquier DB. Ejecutar M0 build/start real con fixtures sintéticas protegidas y todos los intentos conservados. Solo después de salida CP0 aceptada comenzar CP1; mantener dos implementadores y QA.

CI remoto consultado sigue ROJO en `90ebe18f` (verify Unit + integración Neon); no reparado en esta preparación. No push ni PROD. No se ejecutaron tests de producto, DB, build, servidores ni campaña M0; no reutilizar PASS de0238 para0242.
