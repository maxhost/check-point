# 0238 — Inicio de los dos implementadores

Owner autorizó poner en marcha a los implementadores con piezas pequeñas. Inicio sobre `e93d04871c82a6be38db21251de29dab4233c04d`, después del [plan](0238-plan-carga-backoffice.md). Node24; worktrees preparados mediante `tools/worktree-new.sh`, dependencias propias offline y reservas factory. Ninguna configuración de entorno heredada o copiada.

| Implementador | Agente / tarea factory | Worktree y rama | Tramo habilitado |
| --- | --- | --- | --- |
| A, servidor | `/root/backoffice_0238_server` / `backoffice-0238-server` | `/private/tmp/checkpass-0238/backoffice-0238-server`, rama `backoffice-0238-server` | Inventario estático, tipos/consumidores/tests y propuesta mínima de contrato en handoff propio; sin producto |
| B, cliente | `/root/backoffice_0238_client` / `backoffice-0238-client` | `/private/tmp/checkpass-0238/backoffice-0238-client`, rama `backoffice-0238-client` | Inventario estático de seed/consumidores/transportes/casos y propuesta de paths en handoff propio; sin producto |

Solo están reservados sus informes y nombres de helpers nuevos previstos en el plan. No autorizar que editen todo el scope futuro por haber creado un worktree. Antes de cada checkpoint, extender reserva a archivos concretos y enviar la pieza habilitada con base/checks.

## Actualización: contrato aceptado y preparación M0

El owner aceptó explícitamente `scopeKey` después de revisar el ejemplo entre pestañas. Spec cerrada/ADR aceptado mediante6e45066c; el contrato adicional ya no está pendiente. El siguiente gate es M0 antes de optimizar. A prepara fixture protegida real y login existente; B prepara harness de navegador, ambos como tareas de medición explícitas previas a producto. Informes preparatorios locales A2376e128 y B3ed850ad.

PreflightCI de solo lectura:102entradas, último timestamp igual0101 y0DDLpendiente. Hay drift histórico de hashes59/60/64/97; no reparado.111columnas del esquema relevante coinciden con local; esto no certifica toda la DB. ConfigCI seleccionada para worktrees, sin copiar entornoPROD. Build base Webpack de entrega sobrec9fe9356 (producto005b8235 más instrumentaciónopt-in anterior) EXIT0. Diff de apps/packages entre005b8235 y cierreD0 vacío: cambios posteriores eran documentales.

Primera fixture tuvo vida7d pese a writer de episodio nuevo conpolicy.days; validó visibilidad porreadInbox pero no era fixtureM0 válida. Se conserva manifiesto/log, se limpia solo su ámbito y se prepara reemplazo con vida exacta. No medir ni declararPASS M0 con ese primer resultado.

## Condiciones del inicio (histórico)

- La pregunta al owner sobre aceptar o rechazar `scopeKey` de spec§4.3 sigue pendiente al registrar este inicio. Autorizar lanzar implementadores no se interpreta como resolver ese contrato. Spec borrador/ADR propuesto conservados; no comenzar A1/producto ni M0 antes de D0.
- M0 aún no ejecutado. Congelar receta, recursos/harness y fixtures reales protegidas antes de optimizar. Los fixtures e2e que interceptan HTTP no sirven como base de app real.
- La medición anterior mantiene su worktree propio y tarea factory reservada, sin recursos activos. Junto con A/B ocupa las tres reservas operativas; preservarlo. Reutilizar el tercer entorno para medición/QA solo tras reconciliar su evidencia/cambios propios mediante las herramientas y reglas vigentes. No crear un cuarto worktree, retirar el anterior sucio ni modificar el registro a mano.
- `pnpm ci:status` observó remoto `90ebe18` rojo en Unit + integración Neon, con fallos de Stock/resources, guardias de módulos, limpieza de permisos, mock recipes/metrics y analytics-an3. Es estado observado del remoto, no fallo nuevo de0238 ni aprobación de release; no corregirlo por extensión de este encargo ni ocultarlo.

## Precisiones encontradas en preparación

El reporter GET sesión actual no distingue un nuevo login con mismo usuario/negocio porque no entrega identidad de sesión. Mantener su JSON. Si se adopta `scopeKey`, una petición adoptada con la marca anterior recibe409 y da la señal de cambio; no prometer detección inmediata sin interacción ni inferir igualdad de sesión desde el reporter.

B propone inventariar también `settings/module-settings.tsx`, `settings/module-configuration.tsx`, `settings/use-business-modules.ts` y `onboarding/onboarding-tour.ts` antes de adoptar transportes de ámbito. Son candidatos a reserva, no paths ya autorizados para edición: limitar cualquier adaptación a captura de intención/transporte/revalidación, sin dominio o UI nueva.

Este registro no declara checkpoints implementados, tests de producto, DB/servidores/benchmark ejecutados ni QA aprobado. Sin push/PROD;102 migraciones, QA manual, FAIL histórico y diferidos continúan como estaban.
