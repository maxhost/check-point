---
spec: 0181
fecha: 2026-10-08
estado: cerrada
resumen: Nueva orden en tres etapas Mesa, Tomar pedido y Revisar; sin captura de precio POS y con quitar/deshacer líneas.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-cart.tsx, apps/merchant/src/app/backoffice/counter/sale-forms.tsx, tests/e2e/pos.spec.ts
---

# 0181 — Mesa, tomar pedido, revisar

Mini plan cerrado antes de código. Owner autorizó implementar concepto tras
investigación documentada y confirmó API dev sin productos unitPrice null.
L2 por edición de cantidades/payload de orden; contrato HTTP sin cambios.

## Problema

pos-editor.tsx repite mesa/local junto a selección y revisión; PosCart expone importes
al confirmar productos. Captura de precio sin catálogo de precio libre ya no corresponde.
Retirar línea completa obliga a bajar cantidad repetidamente.

## Diseño cerrado

Solo nueva orden usa tres etapas, encabezado indica Paso N de 3 y título de etapa.
Mesa pide etiqueta/local según reglas actuales (último válido o único automático).
Tomar pedido se habilita con contexto válido; entonces inicia catálogo del local.
Tomar pedido muestra categorías/productos con ranking servidor y lupa opcional,
sin formulario de mesa/local ni importes. Contexto mesa/local compacto, acceso volver
a Mesa conserva líneas; cambio local con líneas confirma sin reprecificar.
Revisar pedido contiene producto, cantidad menos/más, Quitar línea completa y
búsqueda Buscar producto para añadir. Sin precios/subtotales/total. Resultados del
catálogo solo cuando se escribe consulta; agregar limpia consulta y mantiene revisión.
Acceso volver a Tomar pedido conserva búsqueda/categoría/posición; un mismo borrador.
Guardar pedido es la CTA final, no cuarta etapa; admite mesa vacía por contrato.

Quitar opera por key de línea, no productId. Deshacer restaura línea, posición,
cantidad, precio interno y lineId; historial local de eliminaciones, máximo 200 líneas.
Nada se escribe hasta guardar. Save exige contexto válido y revisión; en selección
salida protegida lleva a revisar en vez de guardar; desde Mesa lleva a Tomar pedido
si contexto válido, o deja seguir corrigiendo. Auth/404 desmontan, conflictos/error
preservan intención según flujo actual; éxito publica snapshot autoritativo.

No captura de precio en POS, tanto nueva como existente. PosCart elimina NumberField;
DetailedSale admite props opcionales showPrices/allowPriceInput/searchOnly/compactSearch, por defecto
true/true/false/false: Mostrador mantiene precio escrito y UI actual. POS pasa allowPriceInput
false; nueva pasa showPrices false. No se inventa precio para null: addProduct lo
rechaza defensivamente; API ya filtra. Precio cero válido, snapshots previos visibles
en existentes aunque no aparezcan en catálogo. Quitar/deshacer se ofrece en revisión
nueva; presentación de orden abierta/cobro/ticket conserva precios y lógica vigente.
No cambiar servidor, kit, CSS, API, polling, ranking, autosave ni dependencias.

## Archivos

Editor gestiona etapas/borrador, carrito permite presentación sin precios y eliminación,
catálogo compartido añade opciones POS manteniendo defaults Mostrador. Adaptar e2e
existentes a catálogo de precios definidos y etapas; cobertura de revisión/undo/API cero.
No disjunta con 0178/0180; la secuencia nueva reemplaza 0180, abierta se conserva.

## Definition of Done

- [x] Typecheck, lint de archivos, formato, guardia sin aumentos y números verdes.
- [ ] Owner verifica etapas, búsqueda/add, quitar/deshacer, cero y mesa vacía,
      save/errores/retorno, Mostrador sin cambio, con pnpm dev:local.
- [ ] Escenarios e2e adaptados; ejecución se declara pendiente si owner mantiene
      preferencia de no correr suites adicionales. No declarar PASS completo sin evidencia.

## Límites

Sin build/global verify sobre dev activo ni suites adicionales por preferencia del owner.
0 mutaciones nuevas; no afirmar implementada sin gates/QA. Dev, commits de paths GPT,
sin merge/push. API catálogo confirmado en código/contrato de dev. Sin decisiones abiertas.

## Entrega local — 2026-10-08

Typecheck 6 paquetes verde (3,792 s), ESLint de pantallas/fixture, Prettier, guardia
UI 6 archivos sin aumentos, números y diff-check verdes. API de dev confirmada:
route.ts excluye unitPrice null antes de construir ranking; no se tocó servidor.
E2e existentes adaptados; escenario de etapas, cantidades, quitar/deshacer, búsqueda,
precio cero y cero escrituras/lecturas extra agregado, sin ejecución de suites.
QA visual/teclado owner y gates de publicación pendientes; no declarar PASS completo.

## Ajuste cerrado — precarga del catálogo en Mesa

Owner detectó Cargando al pasar a Tomar pedido. Iniciar catalogStarted para nueva
orden al montar paso Mesa; si hay varios locales sin selección, esperar al local.
Local único/recordado precarga inmediatamente; elegir local dispara precarga del mismo.
Cache existente deduplica lecturas en curso y reutiliza resultados por local/contexto.
No precargar todos los locales ni refrescar por paso, TTL o polling.
Tomar pedido habilitado solo con contexto y catálogo disponibles; espera/spinner
permanece en Mesa, no se avanza a catálogo vacío. Fallo muestra reintento explícito
local, sin auto-retry. Dialog de salida no salta esa validación. Orden existente
conserva carga al entrar a Productos. Sin API, cache global, kit ni CSS nuevos.

Verificación del ajuste: typecheck 6 paquetes, ESLint, Prettier, guardia sin aumentos,
diff-check. Escenario wizard incluye catálogo cargado en Mesa y ninguna lectura al
pasar, sin ejecutar suites. QA visual owner pendiente. Fallo de catálogo ordinario
se presenta localmente para permitir retry sin alerta global obsoleta; auth sigue
en onError para revocar caché/editor.

## Ajuste cerrado — cabecera y catálogo del paso 2

Owner pidió retirar ruido textual. Nueva orden oculta visualmente Paso N de 3
(conservado para lectores de pantalla), mantiene título de etapa y contexto Mesa/local
con Text small. Volver deja de ser fila de texto: Button circular del kit con NavArrowLeft
a la izquierda del título, aria-label descriptivo, misma acción anterior; X a derecha
conserva salida protegida. Aplicar flecha también en revisión para coherencia del wizard.

En Tomar pedido, categorías y lupa comparten fila; quitar título Catálogo y fila
separada de toolbar. DetailedSale recibe showHeading opcional, true por defecto;
cuando false une categorías/lupa, manteniendo búsqueda/filtro/draft y ranking.
Mostrador y orden existente conservan header/comportamiento actual. Revisión searchOnly
conservada. Sin CSS, kit, API, cache ni escrituras. Lint/guardia/typecheck, QA owner
pendiente; no nuevas suites ni merge/push.

Ajuste de cabecera aplicado: typecheck 6 paquetes (4,348 s), ESLint, formato,
guardia 6 archivos sin aumentos y diff-check verdes. Aserción e2e existente para
Catálogo ausente y flecha accesible añadida sin ejecución. QA visual owner pendiente.
