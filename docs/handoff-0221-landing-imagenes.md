# Handoff 0221 — Imágenes de landing

Reserva58714dd; código2ea68ec, dev local, sin push/merge.

La preparación previa descargaba srcsets completos mediante fetch sin negociación de Chromium, sin consumir cuerpos ni validar respuestas y ocultaba errores. Ahora usa contextos reales390/1440, visita las mismas siete rutas, activa lazy loading por scroll y exige complete, naturalWidth positivo y decode exitoso en cada imagen visible. Los tests conservan aserciones y presupuestos; no se modificó producto, imágenes, API, servidor ni kit.

El fallo intermitente anterior no se reprodujo en el diagnóstico aislado: caso390light1/1 en14.3s y secuencia17/17 en15.8s. La debilidad de preparación sí es observable en el código; no se afirma una causa única demostrada para el rojo anterior.

Verificación inicial del arreglo:17/17 en18.7s, sin reintentos. Capturas del hero390/1440 revisadas. ESLint/Prettier/diffcheck verdes. M1 en copia temporal intercepta hero con404: exit1 correcto en warmUp, complete:true y loaded:false, URL identificada; archivo restaurado con SHA/bytes iguales. Logs /private/tmp/checkpass-0221-{baseline,baseline-all,fixed,mutation}.log; bitácora /private/tmp/checkpass-0221-mutation.md.

## Verify final

Una sola invocación `CI=true pnpm verify` en `/private/tmp/checkpass-0221-verify`, snapshot `2ea68ec`, base `origin/main` `4208714`: **exit0, verify: ok**. Copia nueva sin caches.next iniciales ni DATABASE_URL en env; integración exclusivamente wrapperCI. Cambios sin commit de Claude0220 excluidos. Log `/private/tmp/checkpass-0221-verify.log`.

| Gate | Resultado | Segundos |
|---|---|---:|
| typecheck | ok | 14.9 |
| lint | ok | 8.1 |
| ui-guard | ok | 1.2 |
| format:check | ok | 9.0 |
| test | ok | 43.9 |
| build | ok | 33.8 |
| test:e2e | ok | 277.9 |
| neon (full) | ok | 468.7 |

Unitarios:275 archivos aprobados/215 omitidos;2677 tests aprobados. E2e global:369 aprobados/62 omitidos, sin fallos ni reintentos necesarios; los17 de landing y24 de equipo incluidos. Neon:449 archivos aprobados/41 omitidos;3583 tests aprobados/282 omitidos. Cuatro builds verdes. Guardia sin aumentos.

Capturas hero390/1440 de la corrida aislada y POS390/1440 de la corrida global vistas. Artefactos globales `/private/tmp/checkpass-0221-verify/test-results/landing-landing-{390,1440}px-light-red-planes-FAQ-y-diseño/`. No se repitió verify después: el cierre posterior modifica solo documentación.

## Límites

Revisión independiente y QA real pendientes. CI remoto sigue rojo4208714 por path de capturasPOS; esa corrección ya está en dev y no se publica en este trabajo. El commit de reserva incluyó inicialmente tres eliminaciones ajenas que estaban en staging; se corrigió inmediatamente58714dd, dejando solo docs y restaurando exactamente ese staging. Código2ea68ec solo incluye landing.spec.ts.
