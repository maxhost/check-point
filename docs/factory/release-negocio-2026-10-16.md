# Release Negocio0235 — corte directo

Estado de preparación: el primer pre-push sobre3fbcd8a6 terminó EXIT1 y **no publicó**. Sus contratos obsoletos quedaron corregidos y probados por dos workers, con QA independiente. Nueva combinación de código7cb270d5; falta repetir el hook completo sobre el commit final de esta ficha. Sin migración PROD ni confirmación nueva de pausa todavía.

## Autorización y alcance

Owner cambia el rollout: no hay usuarios usando la app, acepta el corte directo sin publicar puente. Pide: «vamos a preparar todo para push, dime cuando quieres que pare cron y cuando estes listo subes a github y aplicas en neon las migraciones». Registro2026-10-17 02:13:52UTC (2026-10-16 America/Guayaquil). Autoriza push a main y migración0093–0095 para este release, condicionados a gates, pausa confirmada del cron y cero obligaciones históricas/claims. No se ejecuta PROD mientras falte esa confirmación. No modificar variables ni configurar cron por el owner.

## Candidato y controles

Base dev82194aff, árbol negocio-release-0235 aislado de cambios documentales ajenos sin commit. Incluye entrega de retiro1dfb776b vía combinación aceptada570e169d, conservando commits y fix CI99d18e2f. Runtime idéntico a27a3befb; las diferencias nuevas son tests y un helper importado únicamente por un test. Dos implementadores y QA independiente existentes; no subdelegación ni revisores extra. Sin cambios de runtime, kit/guardias, SQL o journal por las correcciones del release.

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

SHA final, nuevo pre-push, confirmación de pausa, baseline, push, migración, deploy y verificación se agregan con resultados observados; ningún PASS ni hora de ejecución se presupone.

QA independiente aceptó identidad y plan de65b5f443, fuente idéntica27a3befb, sin certificar precondiciones PROD. Lecturas PROD solo lectura02:15:39 y02:17:35UTC:93 migraciones,4 comercios,22 medios,4 pagos con provider pos,0 revisiones/resultados; deliveryprofitability skipped1 y recipes applied1, sin claims ni obligaciones de comisión; sin writers activos observados. Son instantáneas previas, no sustituyen la comprobación después de pausar cron. Baseline definitivo se captura antes del corte.

Primer verify se detuvo antes de build/navegador para completar orígenes locales explícitos; DB local ya guardada. Segundo verify con orígenes/proveedores locales: tipos6/6, lint, guardiaUI32 y formato PASS; unitarios2914PASS/2FAIL/1328skipped (DB excluida aquí). Fallos de contrato obsoleto: fixture cropped aún enviaba timezone a Marca; lista exacta de permisos omitía business. Build4apps PASS antes de detener la tanda durante navegador para corregir esos dos tests; navegador parcial y Neon no certificados por esa tanda. Ningún fallo de red/DNS ni bypass.

Ampliación nominal factory previa a editar: cropped-input-validation.test.ts y staff-permissions.test.ts. Solo se retira timezone del fixture de Marca y se añade business a la lista exacta de ocho; assertions y negativos conservados. Selección corregida63/63 PASS,1,52s; tiposMerchant posterior EXIT0, formato/diff PASS. El pre-push ejecutará verify completo sobre el SHA corregido antes de transmitir el commit; no se declara verify verde a partir de una corrección focal. Artifacts next-env generados se restauran exactamente; logs reales en /private/tmp/checkpass-negocio-release/.

## Primer pre-push y correcciones

El owner informó «Cron parado» pero pidió mantenerlo activo mientras demora el pre-push. Se reconoció la pausa anticipada y se indicó que puede reactivarlo. Se requiere una **confirmación nueva después de los gates**, sin inferirla del primer mensaje.

El comando Git usa un bloqueo adicional temporal fuera del repo: ejecuta el hook original intacto con stdin y argumentos completos, propaga errores y solo después de EXIT0 espera la confirmación nueva. Antes de retornar a Git verifica baseline PROD de solo lectura, cero obligaciones/claims y ausencia de writers. Config persistente sigue.githooks; no bypass ni replay. Wrapper revisado por QA, incluyendo rechazo de timestamps inválidos/antiguos/futuros.

Resultado real del primer intento: tipos6,6s/lint8/UIguard0,9/formato9,7 PASS; unitarios2916PASS56,2s; cuatro builds PASS20,4s. Navegador **1FAIL/446PASS/21excluidos**,127s; Neon paralelo **15FAIL/3950PASS/282excluidos**,681,62s. El wrapper no llegó a11archivos seriales por el rojo paralelo. El coordinador omitió el fallo browser en una actualización y lo corrigió al leer la tabla final. Git terminó EXIT1; remoto siguió5b834ca0. No hay fallo DNS/red observado ni transmisión.

[Contrato y ampliaciones](0235-release-fixes-contract.md). Entrega A **f150317aed11d6b007044395d478c8396d5ea9a6**, fuente f0a7a8f0: cinco suites **22/22 PASS**, sin skips, cuatro wrappers seriales EXIT0. [Handoff A](0235-release-contract-tests.md). Corrige catálogo exacto, FKs/control, deliveryv1/consumo Recipes y replay0086/0087 conservando objetos core/OIDs/hashes; no elimina negativos ni cambia SQL aplicado.

Entrega B **fca45e9c68f8ab36ed0484e47af77cac3a0ddc63**, fuente74cf1bc3: cuatro suites **31/31 PASS**, sin skips, dos wrappers seriales EXIT0; tour **3/3 PASS**, retries0. [Handoff B](0235-release-fiscal-test.md). Fiscal se prueba por Negocio/business real, Brand solo conserva branding y no recibe permiso nuevo; mantiene aislamiento, revisiones, conflictos, atomicidad, slug y lealtad. Browser usa el mismo componente/harness y mocks de siempre; no es smokeapp. Sus dos intentos de infraestructura fallidos (Next/EMFILE sin casos y Chromium IPC antes de UI) se conservan separados del resultado válido con escalación técnica; no se afirma cura de polling.

QA independiente aceptó ambas entregas exactas y su evidencia; combinación7cb270d5 conserva los commits y solo suma docs del coordinador. Recurso CI se transfirió A→B→coordinador después de cada teardown; B confirmó cierre completo2026-10-17 02:58:30UTC, sin procesos/puertos/Next propios. Se restauró el next-env generado. Evidencia real A en /private/tmp/checkpass-negocio-release-contract-tests/ y B en /private/tmp/checkpass-negocio-release/fiscal-test-logs/. Estos focos no convierten el pre-push anterior en verde: el nuevo hook completo sigue obligatorio.
