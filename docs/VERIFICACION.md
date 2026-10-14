# Verificacion proporcional y evidencia

ADR0144 sustituye verify global/revisor/mutaciones por cada feature. No sustituye controles obligatorios de release ni antiPROD.

| Nivel | Trabajo | Comprobacion |
|---|---|---|
| L0 | Texto/imagen/variante puntual reversible | Diff y estaticos pertinentes; render si incierto, sin test nuevo por ceremonia |
| L1 | Layout/ajuste local | Mini plan y checks/recorrido afectado; presupuesto orienta feedback, no permite declararPASS sin prueba |
| L2 | Feature/flujo UI/API | Specchica y casos decisivos de comportamiento/error/regresion en la capa cambiada |
| L3 | Transversal/critico/impacto desconocido | Contratos/invariantes/interacciones y gates amplios segun alcance |

PisoL2 para cambios de comportamiento de dinero/auth/tenant/migracionesPROD. Un color de boton no cambia cobro. Nivel no determina si puede haber dos implementadores.

## Tarea, candidato y release

Autor: tipos/lint/guardias pertinentes y testsfocales. UI pura no migra Neon por defecto. DB solo wrapperCIaislado; dinero/tenant/auth requieren negativos reales cuando cambian. Browsercomponentes prueba interaccion/payload; smokeappreal prueba cableado, no son equivalentes. Captura guardada no es asercion visual.

QA: aceptacion y riesgo de entrega; luego combinacion sobre candidatoSHA exacto. No repetir todo el autor ni abrir revisor extra por defecto. Mutaciones solo para invariante/sospecha concreta y siempre restauradas; los protocolos de seguridad se aplican si se elige mutar.

Main local: pruebas focales del autor, QA independiente y comprobación de integración según los archivos/interacciones realmente afectados. No ejecutar por defecto unit global, todos los browsers, Neon o todos los builds para aceptar una feature y avanzar main local. Ampliar solo por alcance/riesgo/fallo concreto, dejando motivo. Un cambio de UI que consume un contrato estable no vuelve a certificar toda la base de datos.

Publicación: pre-push sigue check-numbers+verify, sin bypass. Ejecutar controles amplios al preparar un push autorizado; main local y publicación son dos cierres distintos. Reutilizacion automatica del hook diferida hasta evidencia de identidad de ref/entorno comprobada. Declarar la duplicación vigente si se ejecuta verify antes del hook, no ocultarla.

Experiencia del primer piloto: se ejecutó verify amplio porque el candidato también contenía backlogPOS/IA/esquema; provocó una demora desproporcionada respecto de las dos UIs. Esa corrida no establece un requisito global para futuras entregas. Registrar PASS focal y fallos/limites por separado; no afirmar verify EXIT0 si hubo fallos recuperados mediante comprobaciones focales.

Evidencia: SHA/base, archivos/checks, runtime/config/lockfile, DBesquema si aplica, resultado/skips. Una identidad incompatible invalida el check; repetir/ampliar por cambio/fallo/duda. Coordinator comprueba evidencia y reproduce señal decisiva cuando hace falta, sin refuerzo ritual de todas las mediciones.

Fixtures no deben inventar estados imposibles. Ningun retry/skip/exit0 sin los casos requeridos sustituye cobertura. Limite de tiempo no rebaja aceptacion. Configuracion/proveedoresIAreal de test explicitamente asignados; ninguna escritura o test libre contraPROD.

DB compartida: reservarla también durante teardown. Las pruebas que retroceden/aplican DDL se ejecutan sin suites concurrentes: `tools/neon-test.sh` separa las suites de migración en la corrida global. Para una selección focal/related con DDL, usar una invocación aislada y `--no-file-parallelism`; el coordinador controla que no haya otro writer.
