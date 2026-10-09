# Entrega 0181 — Wizard de toma de pedido

Implementación local dev. Reserva de spec d4d3819. Sin merge/push.

Nueva orden usa Mesa / Tomar pedido / Revisar pedido; Guardar pedido es acción final.
Mesa valida contexto antes de catálogo; siguientes pasos muestran contexto compacto,
sin formulario repetido. Catálogo compartido de Mostrador, categorías/ranking servidor,
lupa opcional. Revisión sin precios/total, búsqueda para añadir sin salir del pedido,
cantidad menos/más, Quitar por key y Deshacer con línea/posición/cantidad original.
Navegar conserva draft y catálogo, no escribe ni refresca; guarda POST al final.

Sin captura de precio POS: catálogo ya filtra null en API dev, conserva cero.
AddProduct rechaza null defensivamente; líneas nuevas no envían unitPrice. Snapshots
históricos conservados. Mostrador mantiene precio escrito/defaults por props opcionales
showPrices, allowPriceInput, searchOnly, compactSearch. No kit, CSS, servidor, API,
contrato, dependencias o cambios de cobro/impresión.

Verificación real: typecheck 6 paquetes (3,792 s), lint UI/fixture, formato, guardia
6 archivos sin aumentos, números y diff-check. E2e adaptados y escenario de wizard,
revisión, add/quitar/undo/cero/payload/cache agregado, sin ejecución por preferencia
owner de no más suites. No afirmar suite verde ni QA visual comprobado. Owner debe
probar pnpm dev:local: etapas, teclado/búsqueda, regreso, quitar/deshacer, error de
save, cero/mesa vacía; comprobar Mostrador en local antes de pasar a main.
Cambios ajenos gotchas/LECCIONES preservados; staging vacío al entregar.
