# 0242 — CP2a.4 unidades de venta y borradores de Negocio

Estado: preparada, sin autor/reserva. Depende de API sales-units aceptada. Autor nuevo/contexto vacío; coordinador fija base/WT. No subdelegar. Leer protocolos/contrato0242 §2, COPY.md, skill impeccable pertinente y UI actual. Superficie Operate existente: conservar kit/identidad; no init/rediseño ni tocar artefactos de Impeccable/kit/guardias. El coordinador ya cargó contexto una vez en esta sesión; no repetir ni reparar drift por esta tarea. Leer craft-floor inmediatamente antes de editar UI, no durante planificación.

## Resultado

Tercera sección de configuración: unidades de venta por peso kg/lb/g, etiquetas comprensibles kilogramo/libra/gramo, selección múltiple y al menos una. Cargar sales-units con regional/fiscal en BusinessConsole; no serializar solicitudes independientes ni fingir que configurar unidades activa la venta por peso. No texto técnico sobre fases/DB/versiones ni promesas ajenas. Kit CheckboxField/Form/Button/Alert/componentes vigentes; tuteo y labels accesibles.

Las tres secciones comparten revision. Guardar una actualiza revision en las otras dos sin reemplazar valores editados/no guardados. No reintroducir datos viejos por closures o respuestas tardías. Resultado inválido/422 conserva intención y muestra fields.salesMassUnits; unit_in_use conserva selección y muestra productos pertinentes del error sin filtrar otro negocio. Doble submit solo una intención en vuelo.401/403 retira datos/acceso como actual. Error de red o5xx no implica guardado ni retry automático.

Conflicto exige revisar estado autoritativo y conserva intención para reconciliar. No usar el actual reload que reemplaza silenciosamente todos los borradores. Leer las tres secciones y exigir misma revision; si difieren, conservar borradores y ofrecer reconsultar. Conservar baseline por sección/campo para distinguir cambios propios de campos intactos: al reconciliar, campos sin edición adoptan remoto y campos editados retienen intención, mostrando diferencias cuando se solapan. Luego usuario revisa/guarda explícitamente, sin overwrite automático. Descartar puede existir solo como acción explícita e inequívoca; no única salida. La validación fiscal existente sigue aplicándose al borrador reconciliado.

Preferir helper puro pequeño para revisión/reconciliación si reduce cierres obsoletos; probar invariantes reales, no espejo de implementación. Mantener regional/fiscal/medios de pago y actualización de moneda. Iniciales con revisiones diferentes bloquean guardado hasta consulta coherente; no inventar una revisión mayor a partir del máximo recibido.

## Paths previstos

- apps/merchant/src/app/backoffice/business/business-console.tsx
- apps/merchant/src/app/backoffice/business/business-settings.tsx
- apps/merchant/src/app/backoffice/business/business-api.ts, metadatos seguros de errores tipados
- apps/merchant/src/app/backoffice/business/sales-units-fields.tsx, nuevo
- apps/merchant/src/app/backoffice/business/settings-drafts.ts y settings-drafts.test.ts, nuevos si se necesita helper
- tests/e2e/business-negocio-settings.spec.ts
- tests/e2e/support/business-negocio-fixture.ts y business-negocio-entry.tsx
- docs/factory/0242-cp2a-sales-units-ui-handoff.md

Sin server/business/schema/catalog/contratos compartidos/kit/guardias/tooling/deps/estados/índices. Ampliaciones a root antes de editar. Adaptar tests antiguos de descarte al comportamiento aprobado de reconciliación dejando motivo; no reducir aserciones ni ocultar fallos.

## Gate

Node24, tipos merchant/lint/formato/ui-guard y pruebas de estado pertinentes. Browser en harness actual con contrato aceptado: tres GET, guardar cada sección actualiza revision de las otras conservando ediciones, validación lista vacía/422, unit_in_use, conflicto remoto con campos editados e intactos y revisión cruzada durante refresco, error incierto sin retry, permisos/doble submit y regresión regional/fiscal/moneda. Estas respuestas controladas prueban interacción/contrato, no sustituyen guard/DB reales ya certificados en API.

Inspección visual móvil/escritorio en una ronda agrupada, correcciones juntas y una confirmación como máximo conforme impeccable. Capturas abiertas y ligadas al SHA/entorno. Smoke app real con API compatible si entorno seleccionado disponible: declarar límites de auth/fixtures/rol, no atribuir harness a Next→guard→DB. No tests DB aquí por defecto ni tocar fixtures/controlM0. Servidor/puerto propios, procesos detenidos al entregar; no3201/túnel/demos ajenos. Sin M1/fullverify por ceremonia.

QA independiente nuevo sobre candidato congelado, evidencia SHA/runtime/config/resultados/fallos/skips/límites, commit limpio/0procesos. Factory/integración del coordinador. Sin push/PROD; este bloque no completa catálogo/POS por peso.
