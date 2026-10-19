# 0242 — Handoff compacto de UI

## Situación vigente (2026-10-19)

El owner probó sucesivamente las vistas en su navegador y dio por terminada la ronda visual; sus últimos encargos fueron dejar únicamente Nueva orden centrado en la barra móvil de POS y destacar el botón Nueva orden de desktop a la derecha con un + moderado. El sidebar ya muestra Abrir POS. **El owner aceptó explícitamente el punto 1 completo de UI el 2026-10-19**, incluidos los últimos ajustes. SHA de producto: `26222f50`. Preview existente: `http://localhost:3201/backoffice/pos?posV2=1`. No tocar servidor/túnel por oficio.

La ronda UI se completó **directamente, sin agentes ni QA independiente**. Este acuerdo posterior sustituye el pedido inicial de dos implementadores. El owner hace la revisión visual: **sin capturas ni comparaciones de imágenes**. Checks proporcionales; no DB, matrices amplias ni tests nuevos por ceremonia. No reabrir auditoría visual. El owner pide reorganizar el trabajo restante: la cola vigente está en [plan de implementación](0242-plan-implementacion.md), puntos 2–6. No reactivar agentes automáticamente; el próximo corte funcional debe respetar sus contratos y gates de aceptación, sin extrapolar la excepción de QA visual.

## UI entregada

- Listado: tarjetas con nombre, icono/color por tipo, importe y productos consultables. Móvil una columna; filtros en Sheet, por estado/local/tipo. Local actual por defecto; Todos cuando hay varios.
- Nueva orden: Dialog desktop / Sheet móvil, mismo flujo tipo→mesa/nombre/local→Continuar. Mesas y catálogo precargados en PosCache. Mostrador puede entrar directamente cuando sus datos están listos. En móvil solo el botón de la barra inferior abre el Sheet; no hay botones superiores duplicados.
- Editor: catálogo/buscador/categorías, badges editables de nombre/local; Venta actual con controles de cantidad y cliente temporal. Sidebar compacto y columnas adaptadas al ancho disponible. Abrir una orden abierta entra al editor en ambos dispositivos; una existente inicia pestaña Orden y una nueva Catálogo.
- Móvil: badges y X en cabecera; navbar inferior oculta mientras está montado el editor, restaurada al salir. Pie con total arriba y acción principal + MoreVert abajo. Sheet de opciones: Notas, Imprimir, Escanear QR, divisoria, Anular orden; botones con borde, sin X y con Cancelar. Nota visible con icono y prefijo Notas:. Identificación inicial solo desde el Sheet; cliente identificado/beneficio permanecen visibles.
- QR: cámara vertical3:4 centrada256px, campo de código y footer accesible, sin instrucciones redundantes ni scroll interno. Es el scanner existente; no otro transporte/endpoint.
- Guardar: toast Orden guardada y botón Cobrar cuando está limpia; Guardar cambios si se modifica. Abrir el cobro no repite update/create. Anulación persistida conserva confirmación/versionado/owner canónico; borrador requiere confirmar descarte, sin crear orden.
- Cobro: un solo contenido compacto de total/cliente/cupón/medio/recibido/cambio, Dialog desktop y Sheet móvil con botones apilados. Medios precargados y cacheados por identidad; cupón revalidado al cobrar. Cancelar conserva editor. Se eliminó el JSX fullscreen anterior y `measured-scan.tsx`, ya sin consumidores productivos; la identificación real está en el editor.
- Resultado: único receipt con estado, negocio/local, orden, fechas/autores, líneas exactas, nota, beneficios/descuento/redondeo, total canónico y botones Imprimir / Volver al historial. Quitado resumen duplicado de consola; documento de impresión solo se renderiza para print.
- Último ajuste de navegación: barra móvil de operación tiene únicamente Nueva orden centrado, sin POS ni Mostrador. Sidebar muestra Abrir POS usando datos del manifiesto/enlaces autorizados, sin literal de módulo en core. El acceso del sidebar al POS activo conserva query de preview. Nueva orden desktop queda a la derecha con Plus Iconoir y altura48px, sin cambiar tipografía; aplicado también a la presentación legacy todavía accesible.

Los Sheet usan el componente del kit ya autorizado, animado desde abajo, con footer y cierre por Cancelar/backdrop/Escape; no hay gesto swipe implementado. `showCloseButton` permite quitar la X sin deshabilitar los otros cierres.

## Código y contratos a conservar

UI principal: `apps/merchant/src/modules/pos/ui/`, especialmente `measured-console.tsx`, `measured-new-order-dialog.tsx`, `measured-order-list.tsx`, `measured-pos-editor.tsx`, `measured-editor-customer.tsx`, `measured-checkout.tsx`, `measured-ticket.tsx`, `measured-printing.ts` y sesiones/modelos auxiliares. Navegación genérica en `app/backoffice/backoffice-shell.tsx` y `backoffice-navigation.tsx`; Sheet en `src/ui/sheet.tsx`.

No confundir retirada del markup sustituido con retirada funcional completa: `PosConsole`/`PosCheckout` legacy siguen usados por la entrada sin `posV2=1`. No borrarlos ni activar V2 globalmente por oficio. También se conservan estados/detalles terminales y recuperación de conflictos.

Editor, pago y caché pertenecen al padre y a la identidad real. No perder borradores ni abandonar create/close/void inciertos, no generar nuevas claves para reintentos. Capturar request/body antes de await; 403 de la misma identidad no prueba rollback; retirada real de identidad/scope descarta callbacks. Éxito canónico cerrado no vuelve a abierto por un error de UI/impresión. Respuestas actualizan caché sin GETpostwrite automático. Importes/snapshots/medidas exactos: no usar Number como autoridad ni precios actuales para recibos históricos.

Impresión: reutiliza settings preparados. Elegir impresora solo elige; imprimir requiere otro gesto. Callbacks obsoletos no imprimen en otra identidad. Borrador imprime precuenta sin confirmar, sin guardar/cobrar. No afirmar hardware probado por pruebas con API simulada.

## Evidencia y límites

Cada corte registra evidencia focal en el bloque superior de `docs/estado/gpt.md`. Últimos smokes aislados en `/private/tmp/checkpass-*0242/` usan UI real y APIs simuladas, sin capturas ni DB. Se verificaron edición/QR/impresión/cobro/resultado y navegación móvil/sidebar; no sustituyen la aceptación del owner ni QA DB/hardware.

Último corte de navegación: tipos/lint/formato/UIguard focal y smoke real de navbar pasan; `modules/navigation.test.ts` 4/4. Barrido global `modules-boundary-literals.test.ts`: 8/9, falla por cinco archivos ajenos e idénticos al SHA base `3d21a3c9`, sin offender nuevo en navegación. No tocar guardias/baselines ni afirmar verde global. E2E antiguos pueden tener selectores de UI sustituida; no se certificaron suites generales.

Conservar evidencias funcionales anteriores: `0242-cp2d-console-actions-{handoff,qa}.md`, `0242-cp2d-connected-console-qa.md`, plan `0242-plan-implementacion.md`. El siguiente corte es el punto 2: validación focal de impresión/precuenta/reimpresión/anulación sobre el candidato actual. Después quedan masa, retirada funcional/accesos, escenarios reales de fidelización y regresión/M1 según el plan actualizado; la aceptación UI no los certifica.

## Operación

Node24: `source ~/.nvm/nvm.sh && nvm use`. Checkout principal dev; no cambiarlo de rama. No push/PROD sin autorización explícita por operación. WTs factory entregados anteriores se conservan hasta aceptación/cleanup permitido; no retirar trabajo ajeno. Índices/estado solo coordinador.

Preservar `.impeccable/config.json` modificado y untracked ajenos de skills/assets. Stage solo archivos propios explícitos. Sandbox gitdir/Chromium puede requerir escalación acotada propia; no confundirla con fallo del producto ni esperar en silencio.

## Retomar después del clear

> Retoma 0242 desde el bloque vigente de docs/estado/gpt.md, docs/factory/0242-plan-implementacion.md y docs/factory/0242-ui-handoff.md. El punto 1 de UI está aceptado: no reabrir diseño ni sacar capturas. Empieza por el corte focal del punto 2 y continúa los puntos 3–6 en entregas manejables, reutilizando evidencia aceptada. Reconcilia refs/factory antes de código; no reactives agentes automáticamente. Antes de writes mass deben bloquearse los writers antiguos. Conserva servidor 3201/túnel y cambios ajenos. Sin push ni PROD.
