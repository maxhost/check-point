---
spec: 0178
fecha: 2026-10-08
estado: cerrada
resumen: Espacio común Pedido/Productos, guardado explícito y salida protegida para nueva orden y mesas abiertas.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-cart.tsx, tests/e2e/pos.spec.ts
---

# 0178 — Espacio de pedido POS mobile

L2. Owner autorizó implementar la propuesta de investigación UX 2026-10-08.

## Problema

`pos-editor.tsx:103` antepone Card de contexto al catálogo. `pos-cart.tsx:116`
revisa líneas en scroll dentro del footer. Consola separa detalle de Editar;
X desmonta un borrador sin confirmar. Ver informe en design-explorations.

## Diseño cerrado

PosEditor pasa a ser el espacio común de nueva orden y orden abierta. Usa kit,
Tailwind/tokens, DetailedSale de Mostrador y datos/cache existentes. Sin tarjeta
exterior ni navbar mobile. Nueva abre Productos; existente abre Pedido. Un único
borrador, con líneas reales/snapshots. Alternar conserva catálogo montado, búsqueda,
categoría y posición; no dispara GET/PUT. Pedido tiene un solo scroll del documento,
cantidad editable por línea y precio escrito cuando corresponde. Retirar el carrito
expandible dentro del footer. No existe botón Editar ni modo adicional para añadir.

Cabecera única mesa/Nueva orden y X. Nueva muestra mesa/local en una fila compacta,
sin Card; local único no se pide. Varios locales: último elegido válido del montaje
y contexto autorizado, o selección explícita (no elegir el primero). Existente
permite cambiar identificación con Dialog del kit. Cambiar local con líneas pide
confirmar y explica que conserva líneas/precios; nunca borra ni reprecifica.

Footer con artículos/total y primaria contextual: Guardar orden (nueva), Guardar
cambios (existente con cambios), Cobrar (existente sin cambios). Nueva vacía sigue
permitida. Validación visible dice si falta mesa/local/precio o exceso de líneas.
Cobrar solo usa snapshot confirmado; no combina guardar/cobrar ni auto-save.
En Pedido, acceso Añadir productos; en Productos, acceso Ver pedido. Más acciones
abre Dialog del kit: Imprimir precuenta, Anular orden y datos de creación. Imprimir
y anular disponibles solo con orden guardada sin cambios; anular conserva lectura
previa/confirmación. Ticket completo separado para impresión. Checkout, resultado
cerrado y UUID/cuerpo congelados se conservan.

X sin cambios vuelve al listado. Con cambios: Dialog Guardar y salir / Descartar /
Seguir trabajando. Guardar fallido no sale y conserva borrador. Links internos al
backoffice se interceptan con la misma decisión; navegación de recarga/cierre usa
beforeunload mientras hay cambios (limitación del navegador, especialmente móvil).
No se introduce interceptación de history ni garantía de recuperación tras cierre
forzado. La salida durante escritura se bloquea. Contexto autorizado/404 limpia
borrador con las reglas existentes y desmonta el editor.

Escrituras devuelven orden autoritativa; se publica caché y se reinicia baseline
local solo tras éxito. Error 5xx/transporte/422 conserva borrador y permite reintento
explícito, sin nuevas estrategias de POST/idempotencia. Conflicto 409 conserva
intención local visible y versión del servidor: bloquea guardar/cobrar hasta revisar
y aceptar explícitamente la versión actual; muestra ambos pedidos en Dialog.
Sin snapshot se relee una vez y se bloquea hasta recuperar, según 0172. Si orden
ya no está abierta, se muestra estado real; no permite sobrescribir. No mezclar
líneas por productId cuando tienen distinto lineId/precio.

Contrato HTTP y errores de 0169/0172 sin cambios; auth/aislamiento/cache se conservan.
No polling, TTL, auto-save, tablas predeterminadas, cocina ni cambios de servidor/kit.
No disjunta con POS. Mostrador no cambia.

## Archivos

Consola integra editor en abierta/nueva y devuelve resultado al guardar. Editor
gestiona superficies, borrador y protección. PosCart se reutiliza como listado de
líneas sin footer/scroll propio; helpers de precios/cantidades permanecen.
Pruebas e2e se adaptan a interacción nueva y agregan los casos de transición.

## Definition of Done

- [ ] Nueva/existente usan mismo espacio; cantidades/precios/snapshots correctos.
- [ ] Alternar mantiene búsqueda/filtro/draft y no genera GET/PUT adicionales.
- [ ] Contexto compacto y último local válido; cambio con consumos confirmado.
- [ ] X/links: seguir, descartar y guardar-salir; fallo de guardado conserva draft.
- [ ] Conflicto conserva intención y obliga revisión; auth/404 limpian; cobro
      sin guardado pendiente, cierre/cupón/UUID conservados.
- [ ] Impresión con comercio/local/mesa; móvil 360/390 y escritorio vistos,
      sin overflow ni contenido tapado; teclado real queda para owner.
- [ ] e2e POS y Mostrador afectados, typecheck, lint, formato, guardia y números verdes.

0 mutaciones nuevas (L2). Sin build/global verify sobre dev activo; verify antes de
main. QA owner con pnpm dev:local pendiente; no marcar implementada sin gates.
Solo commits de paths GPT en dev, sin merge ni push. Sin decisiones abiertas.

## Entrega local — 2026-10-08

UI aplicada en dev. Owner probó y confirmó: «listo. parece estar todo funcionando»;
la siguiente iteración visual queda para después. Luego pidió detener las pruebas
y dejar los commits preparados para que Claude publique, sin push de GPT.

Verificación realizada antes de detener: typecheck de 6 paquetes, ESLint de las
pantallas, guardia UI sin aumentos y 5 e2e POS seleccionados verdes (4,7 s): creación,
edición con snapshot/lineId, impresión/cierre, error de cupón, catálogo compartido,
ranking parcial y líneas duplicadas/retiradas. Prettier aplicado a los cuatro archivos.
Después se adaptaron otros escenarios e2e al workspace y se ajustó impresión tras
cerrar el Dialog y limpieza del último local al revocar contexto. Esa revisión final
no tuvo ejecución adicional por instrucción del owner. La suite completa y los
escenarios nuevos de salida/conflicto no se declaran verdes; los checks DoD que
requieren esa evidencia permanecen abiertos. Claude conserva los gates normales
antes de publicar. Sin API, kit, servidor, dependencias, merge ni push.

## Ajuste cerrado — márgenes comunes POS

Owner detectó diferencias entre listado, nueva orden y orden abierta. El main
merchant-shell usa 24 px (48 desde 700 px); counter-shell.counter-flow aplica
14 px laterales y 16 superiores hasta 959 px; backoffice-home limita listado a
860 px mientras workspace usa w-full. Unificar main con px-6 pt-6 md:px-12 md:pt-12
(24 px mobile, 48 desde md), w-full; contenido backoffice-home w-full en todas las
vistas. Conservar counter-flow solo para comportamiento del pedido, y padding
inferior existente de navbar/footer/print. Sin CSS, kit ni cambios de navegación,
API, cache o escrituras. Se revisan formato, lint y guardia; QA visual owner pendiente.
