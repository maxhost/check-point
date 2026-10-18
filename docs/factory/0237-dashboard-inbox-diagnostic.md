# Dashboard: diagnóstico inicial y plan de velocidad

Encargo del owner, 2026-10-17: medir primero la entrada al Inbox y después planificar un Dashboard con Inbox, punto de equilibrio mensual y diario, ventas acumuladas y actualización por ventas. Considerar caché y optimización de DB. Este documento es diagnóstico y propuesta; no cambia producto, fórmulas, esquema ni diferidos. Sin push ni operaciones PROD. Pendiente aclarar el problema adicional de análisis mencionado al final del mensaje del owner.

## Evidencia disponible y límites

Lectura inicial sobre `73a4966d`; al capturar evidencia HEAD era `005b8235d3178295037efbf5deca29596f69c80a`. Los dos commits intermedios son documentación ajena; no se cambiaron sus archivos. Node 24.20.0. Servidor Merchant local existente en puerto 3201. `node tools/local-db/check-env.ts` EXIT0: configuración Merchant DB local y correo console, sin conexiones PROD. Esto verifica configuración en disco, no inspecciona el entorno privado del proceso ya levantado.

Observaciones **preexistentes** extraídas de `.dev-local/merchant.log`, no nueva corrida de navegador ni benchmark frío:

| Ruta | Muestra | Tiempo servidor |
| --- | --- | --- |
| `/backoffice` | Las 7 entradas exactas registradas, HTTP 200 | 669–939 ms |
| `/api/analytics/inbox` | Últimas 12 de 17 peticiones registradas, HTTP 200 | 605–1015 ms |

En esas 12 peticiones de Inbox el tiempo atribuido a Next es 2–32 ms y a aplicación 603–985 ms. No permite separar auth, SQL, conexión, locks, cálculo ni efectos de concurrencia. Las muestras no tienen identificación por sesión/carga ni estado ready/preparing: no se deben sumar entre sí, atribuir a un comercio, convertir a un tiempo de pintura o extrapolar a PROD. Archivo saneado con todas las observaciones, líneas, hash y fecha del log: `/private/tmp/checkpass-inbox-log-baseline-20261017.json`. No contiene cookies, emails ni cuerpos de respuesta.

**Medición nueva de entrada autenticada pendiente:** se solicitó email de cuenta local para iniciar sesión por el flujo existente (correo console). No usar ni exportar una sesión privada del navegador del owner. No se simulará una respuesta HTTP para presentarla como medición real.

El FAIL previo de evaluación fría 1817,621042 ms >1000 ms sigue vigente; mide otro recorrido y no es el tiempo de entrada del Inbox. No hubo nueva evaluación fría ni operación sobre la DB perf.

## Hallazgos del código

- `app/backoffice/page.tsx` carga sesión y suscripción. El layout también llama al guard y lee facturación; el guard de página vuelve a leer facturación cuando corresponde. Candidatos a compartir lecturas dentro de la petición preservando los distintos gates.
- `analytics/inbox-state.ts` comienza el GET en un efecto después del montaje. `panel-request.ts` usa `cache: no-store`. Existe una dependencia página → JavaScript/montaje → Inbox.
- `server/analytics/http/index.ts` autentica y lee Inbox. Si no está ready inicia evaluación, espera hasta 3000 ms y vuelve a leer. El límite cubre esa espera, no toda la petición.
- `server/analytics/lifecycle/index.ts` abre transacción, toma try-lock por comercio, lee zona, run y candidatas/controles; resuelve acciones, vence contenido, consume recordatorios y registra exposición. Una lectura tiene efectos: una caché de la respuesta completa no puede saltárselos sin un diseño explícito.
- `actionContext` consulta módulos habilitados fuera del objeto transacción del lector. Medir el tiempo de esa consulta y su conexión por separado; no se afirma que sea el cuello de botella.
- El Inbox refresca en montaje, foco, vencimientos, recordatorios y preparación pendiente; no recibe una notificación de nueva venta.
- POS ya publica eventos durables y programa procesamiento posterior a la respuesta, acotado a 20 s/lote 50. Ingesta actualiza métricas diarias por deltas. El presupuesto no garantiza frescura en 20 s ni entrega exitosa; conservar recuperación y deduplicación.
- Ya hay índices de métricas por comercio/día, dos parciales orientados a consultas específicas y claves para candidatas/controles. No hay evidencia nueva que justifique añadir índices todavía.

## Medición propuesta

1. Entrada directa con contexto nuevo de navegador autenticado, sin caché de navegador y sin precalentar la ruta objetivo. Registrar si Next compila, porque desarrollo no equivale al build de entrega. Conservar el primer intento aunque falle.
2. Capturar navegación, TTFB de página, inicio/fin de GET Inbox, estado devuelto, tamaño y momento de contenido visible. Registrar también peticiones concurrentes de sesión, módulos y onboarding. Evitar guardar cuerpos, cookies o un HAR sin sanear.
3. Medir por separado regreso mediante navegación interna y recarga. Cada observación conserva etiqueta, SHA, entorno y resultado; no escoger la más rápida ni presentarlas como un mismo caso frío.
4. En entorno aislado, medir las etapas servidor: auth, conexión/BEGIN, lock, consultas de Inbox, módulos, efectos de ciclo, evaluación si la hay, serialización y commit. La instrumentación debe ser temporal/local y mantenerse dentro del reloj total.
5. Separar ready de preparación pendiente y contención. No resetear el run ni los datos del comercio del owner para fabricar un caso frío. Casos sintéticos/SQL por `tools/neon-test.sh`, con DB protegida reservada e inventario previo de migraciones; no reutilizar automáticamente la DB perf histórica.
6. Obtener EXPLAIN (ANALYZE, BUFFERS) de consultas identificadas en base de prueba representativa. Reportar filas, loops, buffers, tiempos, volumen y distribución por comercio. No llamar fría a una observación EXPLAIN caliente.

## Plan de implementación, después de la medición

Orden por dependencias; alcance funcional/contrato y checks antes del código. No ejecutar por defecto el benchmark antiguo ni baterías globales.

1. **Reducir el camino inicial.** Reutilizar contexto de sesión/facturación dentro de una petición; comenzar lectura de Inbox en servidor y permitir que la estructura de página se muestre mientras llega el contenido. Comparar el tiempo hasta avisos utilizables: mover la espera al servidor no constituye por sí solo una mejora. Evitar GET duplicado al hidratar. Separar preparación pendiente de la respuesta inmediata con estado veraz y recuperación, conservando política/ciclo/exposición.
2. **Resumen del Dashboard.** Un contrato pequeño y coherente para ventas del día/mes, meta mensual, referencia diaria, avance y faltante. Basarse en agregados de Analíticas, sin recorrer ventas históricas en cada entrada ni acceder a tablas de módulos desde core. Mantener dinero exacto, moneda, zona, cobertura de costos y null pendiente. Especificar fecha de datos/frescura y qué ocurre cuando revenue llega antes que costos/comisiones.
3. **Caché selectiva.** Primero memoización por petición; después reutilización entre visitas donde la invalidación esté resuelta. Separar snapshot numérico y efectos del Inbox. No adoptar Redis, un servicio o nuevas tablas antes de demostrar necesidad.
4. **DB.** Reducir rondas, columnas y filas leídas; revisar tiempo de conexión, transacciones y contención con evidencia. Añadir índices solo si el plan los justifica, midiendo costo de escritura/espacio. DDL requiere asignación explícita; migraciones históricas inmutables. Sin cambios a PROD.
5. **Actualización por eventos.** Después de aplicar la proyección de una venta, notificar cambio al Dashboard de ese comercio y recuperar una versión coherente del resumen. Agrupar ráfagas y resolver reconexión, múltiples pestañas/dispositivos y cambios fuera de la sesión. Elegir transporte compatible con hosting tras revisar requisitos; no fijar todavía proveedor ni implementación. Relectura al volver al foco/reconectar como recuperación.

## Política propuesta de reutilización

| Datos | Reutilización | Invalidación necesaria |
| --- | --- | --- |
| Marca y configuración del comercio | Por comercio y versión; memoria de navegación o caché servidor | Guardado por cualquier actor autorizado, no solo el navegador actual |
| Módulos y navegación | Por comercio y permisos efectivos | Activación/desactivación, cambio de permisos y sesión |
| Autorización y acceso de facturación | Compartir lectura dentro de la petición | Nueva petición vuelve a validar; considerar también vencimientos temporales y webhooks |
| Resumen numérico | Por comercio, ámbito/local, moneda, día en su zona y versión de fuentes/política | Venta/anulación, costos, comisiones, gastos y sus correcciones, cambio de día/mes/zona/política |
| Inbox | Snapshot separado del ciclo de exposición/decisiones | Nueva candidata, decisión de otro actor, recordatorio, vencimiento, cambio de día/política/permisos |

Mostrar información anterior durante una revalidación requiere identificarla como tal; no presentar datos de ayer como actuales. Limpiar datos privados al salir o cambiar identidad/comercio. Un TTL puede ser respaldo, no reemplaza los eventos ni garantiza por sí solo consistencia.

## Definición pendiente de referencia diaria

La fórmula actual de `calculateGoal` calcula equilibrio mensual con condiciones de cobertura/margen y mes de gastos cerrado. Su `targetMinor` es un objetivo condicionado al riesgo, calculado sobre faltante y días de actividad restantes; **no es un punto de equilibrio diario universal**.

Antes de implementar hay que distinguir: cuota diaria de la meta mensual, o cuánto hace falta vender hoy para recuperar el ritmo. Proponer exponer ambos conceptos con nombres distintos si el owner los quiere; no cambiar silenciosamente la fórmula existente ni inventar valores cuando falten datos. Ventas acumuladas y avance sí cambian con cada venta aplicada; la meta cambia cuando lo hacen sus insumos.

## Cierre pendiente

Completar medición autenticada y aclaración de problema adicional; después fijar presupuesto para primera pintura útil, respuesta ready y frescura por venta, con ambiente/volumen explícitos. No se declara PASS de rendimiento ni QA manual. CI roja histórica, rendimiento FAIL, clima/calendario, ciudades/cron remoto, ahorro y Marketing/cupón/tarjeta 11 parqueada se conservan.
