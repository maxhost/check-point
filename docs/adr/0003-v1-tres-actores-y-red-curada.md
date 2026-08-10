---
fecha: 2026-08-09
resumen: La V1 sirve a consumidor, comercio y administrador de plataforma; incluye exploración curada de rutas y eventos.
---

# ADR 0003 — V1: tres actores y red curada

## Contexto

ADR 0001 enfocó correctamente el valor en campañas rentables, pero redujo el producto a una consola de bar. Mi Pasaporte necesita además el wallet del consumidor y una capa editorial central que conecte los locales en rutas, categorías y eventos.

## Decisión

La V1 tiene tres superficies:

1. **Consumidor:** cuenta, wallet único, QR personal, check-in y exploración de rutas/eventos.
2. **Comercio:** backoffice para configurar su programa, campañas, juegos habilitados, premios/cupones; app web operativa para asignar y validar beneficios.
3. **Administrador de Mi Pasaporte:** alta y gestión de negocios, rutas, categorías y eventos curados.

La V1 implementa ruleta. La raspadita y otros juegos se modelan como mecánicas futuras del catálogo, pero no se construyen hasta validar la ruleta.

## Consecuencias

- ADR 0001 se interpreta como límite de mecánica inicial, no como eliminación del backoffice ni de la red de descubrimiento.
- La ruta es editorial: muestra comercios y puede tener check-ins/sellos visuales; no transfiere oportunidades, puntos ni cupones entre comercios.
- El backoffice configura el programa de cada negocio; el administrador de plataforma no necesita hacerlo por ellos.
