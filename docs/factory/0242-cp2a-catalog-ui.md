# 0242 — CP2a.7 catálogo: tarifas exactas, medida y conflictos

Estado: preparada. Autor nuevo/contexto vacío, sin subdelegar. Coordinador asigna WT/base/paths antes de código. Depende del servidor catálogo V2 aceptado en main4ed096fd. Leer protocolos, contrato0242 §1–2, COPY.md y UI pertinente; no toda la historia de0242.

## Resultado y contrato

Migrar el cliente del catálogo existente a X-Catalog-Contract:2: GET catálogo, POST/PUT productos y DELETE producto. Tarifas string/null de punta a punta, sin Number/parseFloat/toFixed como autoridad; conservar literalmente tarifa legacy alta al editar otros campos. Nuevo input estricto9dec/límite aprobado con helpers aceptados; vacío es null, cero válido. Formato monetario visible exacto usando fracción original/BigInt y moneda; no ocultar precisión significativa de tarifa bajo dos decimales. No editar helpers financieros/medidas aceptados para facilitar UI. Adaptar los callers pertinentes sin cambiar importación IA ni su dinero persistido.

Checkbox kit «Este producto se vende por peso» y selector kilogramo/libra/gramo habilitados por negocio. Precio/costo indican «por kilogramo/libra/gramo»; unit conserva su significado actual. No inferir unidad por nombre/precio ni cambiar tarifa al alternar selector. Un producto nuevo empieza unit; DTO histórico unit sigue legible. Campos de medidas/revisión viajan explícitos y PUT usa expectedSalesRevision del producto abierto, sin reemplazarla silenciosamente tras una recarga.

Ampliación técnica aditiva autorizada: GET /api/catalog V2 incluye salesMassUnits desde business_configuration del negocio autenticado, default ['kg'] solo si no existe configuración. V1 conserva shape. Esta lista usa el guard catalog existente y evita pedir permiso business a un operador catalog; no llamada adicional a business/sales-units ni credencial nueva. Se reutiliza el tipo MassUnit. El writer ya revalida unidad bajo mutex, por lo que una lista obsoleta no autoriza escritura. Solo ampliar listCatalog/core.ts y prueba HTTP asignada, no reescribir writer/guards.

Conflicto409 catalog_changed conserva todo el borrador (nombre/tarifas/medida/locales/imagen) y presenta estado autorizado para revisar. No retry automático ni overwrite con revisión nueva sin revisión explícita del usuario. Campos intactos pueden adoptar remoto, editados conservan intención; mostrar solapamientos y permitir guardar explícitamente tras revisar o descartar explícitamente. Si producto desapareció, no convertir edición en alta. Otros409 measurement_basis_required/pos_client_upgrade_required y422 invalid_unit/invalid_price preservan intención y muestran error seguro. No reintentar una escritura confirmada si falló solo el GET posterior; mantener el comportamiento vigente de reintento solo de lectura. Doble envío bloqueado;401/403 retira acceso/datos y no muestra éxito. Error red/5xx es estado incierto sin retry automático, con revisión autoritativa antes de otra escritura cuando no se conoce resultado.

Conservar categorías/locales, disponibilidad/importInProgress, CRUD/tours y selección/imagen existentes. No rediseñar catálogo. Kit/guard/COPY vigentes: no nuevos nativos/handlers/style/paleta/CSS ni cambios al kit para apagar rojo. Impeccable ya aplicada; root cargó contexto una vez en esta sesión (Operate existente, refinamiento permitido sin init/drift/rediseño). Autor lee harden y craft-floor inmediatamente antes de editar; no rerun context ni artefactos ajenos. Ronda visual agrupada390/1280 y una confirmación como máximo.

Mass/precisión siguen bloqueados por constraints temporales hasta CP2c. Esta UI se prepara localmente y NO se publica ni se afirma guardado real mass exitoso. No feature flag nuevo, migración, quitar barreras, producer4 ni copy técnico sobre fases/DB. Harness puede representar el contrato futuro aceptado y verificar payload/errores; distinguirlo de las pruebas reales que aún deben rechazar mass/precisión. Gate de activación y recorrido auténtico mass queda enCP2c.

## Paths autorizables

- apps/merchant/src/app/backoffice/catalog/types.ts
- apps/merchant/src/app/backoffice/catalog/use-catalog.ts
- apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts
- apps/merchant/src/app/backoffice/catalog/product-editor.tsx
- apps/merchant/src/app/backoffice/catalog/catalog-list.tsx
- apps/merchant/src/app/backoffice/catalog/catalog-page.tsx
- apps/merchant/src/app/backoffice/catalog/catalog-product-draft.ts y catalog-product-draft.test.ts, nuevos si separan reconciliación/parseo
- packages/domain/src/server/catalog/core.ts, solo proyección salesMassUnits V2
- apps/merchant/src/modules/pos/server/catalog-v2.neon.integration.test.ts, solo metadata/default/guard/tenant/V1 y regresión de barreras
- tests/e2e/catalog-measures.spec.ts, nuevo
- tests/e2e/support/catalog-api-fixture.ts
- tests/e2e/support/catalog-tour-fixture.ts, solo fixture/typing si necesario
- tests/e2e/catalog-tour-crud.spec.ts, solo expectativas payload V2/errores afectados sin reducir cobertura
- docs/factory/0242-cp2a-catalog-ui-handoff.md

Sin business/Recetas/Stock/POS operativo/schema/journal/kit/guardias/tooling/deps/estados/índices/importación IA/imagen backend. Ampliaciones concretas a root antes de editar. No servidores3201/túnel/M0 ni fixtures ajenas. Puerto/artefactos propios y dependencias aisladas.

## Gate

Node24, tipos3/lint/formato/ui-guard y guardias pertinentes; exactamente24PASS/2FAIL de backlog conocido no equivale a global verde. Puros solo para invariantes reales de exactitud/reconciliación. Browser focal: headers y stringpayloads exactos incl9dec/cero/null/legacyalto, modos/labels/unidades habilitadas, conflicto con campos propios/intactos/solapados, error sin pérdida, permiso/doble submit y fallo de lectura sin duplicar POST/PUT. Regresión CRUD/tour afectada sin reescribir todos los tests por ceremonia. Abrir capturas390/1280 ligadas a SHA y entorno.

CI solo después de root transfiera recurso, wrapper/env seleccionado y --no-file-parallelism hasta teardown completo. Prueba real adición salesMassUnits: defaultkg sin inserción, lista configurada por negocio, operador catalog sin business, V1 sin campo nuevo, tenant/auth/no-store conservados. No activar mass para fabricar prueba. Reusar evidencia compatible del catálogo aceptado y repetir señal afectada, no toda la batería anterior.

Congelar código antes de checks y guardar logs completos fuera WT con SHA/comando/exit real. Entrega limpia con límites/fallos/skips/procesos y sin push/PROD. QA nuevo independiente sobre candidato combinado congelado; factory/integración/cleanup del coordinador.
