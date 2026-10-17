# Release Negocio0235 — corte directo

## Autorización y alcance

Owner cambia el rollout: no hay usuarios usando la app, acepta el corte directo sin publicar puente. Pide: «vamos a preparar todo para push, dime cuando quieres que pare cron y cuando estes listo subes a github y aplicas en neon las migraciones». Registro2026-10-17 02:13:52UTC (2026-10-16 America/Guayaquil). Autoriza push a main y migración0093–0095 para este release, condicionados a gates, pausa confirmada del cron y cero obligaciones históricas/claims. No se ejecuta PROD mientras falte esa confirmación. No modificar variables ni configurar cron por el owner.

## Candidato y controles

Base dev82194aff, árbol negocio-release-0235 aislado de cambios documentales ajenos sin commit. Incorporar entrega de retiro1dfb776b vía combinación aceptada570e169d, conservando commits y fix CI99d18e2f. Fuente final debe ser idéntica a27a3befb en apps/packages/tools/.github. Dos implementadores y QA independiente existentes; no subdelegación ni revisores extra. Sin código nuevo previsto ni cambios de kit/guardias/esquema.

Reserva db:modules-ci durante verify/pre-push y teardown; suites únicamente tools/neon-test.sh con configuración CI seleccionada, nunca DATABASE_URL PROD. Configuración local/CI asignada por clave, sin copiar env de PROD. Verificar gates obligatorios del SHA final y conservar log completo; no bypass. Si falla por red/DNS, detener y consultar al owner según su instrucción previa.

## Corte acordado

1. Preparar candidato congelado, QA de identidad/operación y gates de publicación. El cron sigue activo durante esta preparación.
2. Pedir pausa del job y esperar confirmación del owner. Comprobar ausencia de invocaciones/writers anteriores y obligaciones/claims de comisión antes de retirar su handler; si hay pendientes, no publicar hasta resolverlos con autorización específica.
3. Registrar baseline SQL solo lectura (journal, conteos, IDs/fingerprints/OIDs, FK y resultados). Confirmar remoto/base y ningún nuevo pendiente. Push normal a main, sin force ni bypass, desde árbol limpio exacto.
4. Aplicar0093+0094+0095 juntas con migrador oficial y host directo PROD guardado por huella; sin SQL manual separado. Mantener la app fuera de servicio hasta esquema completo y Vercel READY del mismo SHA. No asumir orden entre build y migración.
5. Comparar baseline, identidades/FK/resultados, precisión0095 y cero obligaciones/claims; comprobar Negocio/permisos, selector/cierre y comisión con una venta de prueba del owner. Reactivar cron después de comprobar el corte, a cargo del owner.

## Recuperación y límites

Antes de migrar, un fallo detiene publicación/corte. Después del movimiento, no volver al binario0092 ni revertir tablas: corregir hacia adelante o usar artefacto compatible con core revisado y autorización propia. Puente anterior queda como referencia, no como candidato a publicar automáticamente. No recalcular ventas anteriores ni borrar/reinterpretar obligaciones. El retiro conserva lectores, resultados, mapping e IDs.

## Evidencia y resultado

Preparación en curso. SHA final, gates, confirmación de pausa, baseline, push, migración, deploy y verificación se agregan con resultados observados; ningún PASS ni hora de ejecución se presupone.

QA independiente aceptó identidad y plan de65b5f443, fuente idéntica27a3befb, sin certificar precondiciones PROD. Lecturas PROD solo lectura02:15:39 y02:17:35UTC:93 migraciones,4 comercios,22 medios,4 pagos con provider pos,0 revisiones/resultados; deliveryprofitability skipped1 y recipes applied1, sin claims ni obligaciones de comisión; sin writers activos observados. Son instantáneas previas, no sustituyen la comprobación después de pausar cron. Baseline definitivo se captura antes del corte.

Primer verify se detuvo antes de build/navegador para completar orígenes locales explícitos; DB local ya guardada. Segundo verify con orígenes/proveedores locales: tipos6/6, lint, guardiaUI32 y formato PASS; unitarios2914PASS/2FAIL/1328skipped (DB excluida aquí). Fallos de contrato obsoleto: fixture cropped aún enviaba timezone a Marca; lista exacta de permisos omitía business. Build4apps PASS antes de detener la tanda durante navegador para corregir esos dos tests; navegador parcial y Neon no certificados por esa tanda. Ningún fallo de red/DNS ni bypass.

Ampliación nominal factory previa a editar: cropped-input-validation.test.ts y staff-permissions.test.ts. Solo se retira timezone del fixture de Marca y se añade business a la lista exacta de ocho; assertions y negativos conservados. Selección corregida63/63 PASS,1,52s; tiposMerchant posterior EXIT0, formato/diff PASS. El pre-push ejecutará verify completo sobre el SHA corregido antes de transmitir el commit; no se declara verify verde a partir de una corrección focal. Artifacts next-env generados se restauran exactamente; logs reales en /private/tmp/checkpass-negocio-release/.
