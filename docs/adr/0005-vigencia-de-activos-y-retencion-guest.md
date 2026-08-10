---
fecha: 2026-08-10
resumen: La vigencia la define el emisor del activo; los guests quedan inactivos a seis meses y se eliminan a los doce meses sin actividad.
---

# ADR 0005 — Vigencia de activos y retención guest

## Contexto

La cuenta guest no debe durar para siempre, pero una política de eliminación no puede reemplazar las reglas comerciales de vencimiento. Un cupón puede vencer mañana, puntos pueden expirar por inactividad y un sello de Pasaporte debe conservarse como reconocimiento.

## Decisión

1. Cada programa de comercio define la expiración de sus puntos y las condiciones de sus cupones/créditos de juego. Ejemplos: puntos con vigencia de un año o puntos que expiran tras tres meses sin compra acreditada; los cupones y créditos llevan fecha/hora de caducidad propia.
2. Sellos y coleccionables emitidos por Mi Pasaporte no expiran.
3. La actividad del consumidor se mide por acciones iniciadas por él: check-in, apertura/interacción intencional del wallet, mostrar su QR, jugar o canjear. Una asignación realizada unilateralmente por personal no reinicia el contador.
4. Un guest sin actividad durante seis meses pasa a estado `inactive`, sin borrar activos. Si vuelve antes de los doce meses y realiza actividad, se reactiva.
5. Un guest que complete doce meses sin actividad se elimina junto con sus puntos, cupones, créditos, sellos, coleccionables y check-ins. Los registros operativos necesarios para métricas se conservan solo de forma agregada o anonimizada, sin identidad recuperable.

## Consecuencias

- La inactividad de cuenta no prorroga ni reemplaza el vencimiento de un beneficio.
- La pantalla puede mostrar activos vencidos por un período de historial, pero no permite usarlos.
- El programa de comercio debe poder configurar y aplicar sus políticas de vencimiento en una spec posterior.
