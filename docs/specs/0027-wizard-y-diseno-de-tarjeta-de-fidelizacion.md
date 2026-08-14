---
spec: 0027
fecha: 2026-08-13
estado: en curso
resumen: La creación del programa de fidelización pasa a un wizard por pasos (Puntos y Sellos) e incorpora el diseño visual de la tarjeta de Sellos (colores de fondo con degradé, color de borde de los recuadros) con preview en vivo.
disjunta: no
archivos: apps/merchant, migración Drizzle, Neon, pruebas y docs
---

# 0027 — Wizard de creación y diseño visual de la tarjeta de fidelización

> **Estado: BORRADOR.** Requisitos capturados del owner al cierre de la sesión del 2026-08-13.
> Falta cerrar las decisiones de la sección «Abierto» con el owner antes de tocar código
> (protocolo del repo: spec cerrada → implementación).

## Problema

Hoy la creación del programa de fidelización es un formulario único (`program-editor.tsx`).
El owner quiere un **wizard por pasos** para crear (tanto Puntos como Sellos) y, para Sellos,
poder **diseñar la tarjeta** (colores de fondo, borde de los recuadros del sello) y ver un
**preview en vivo** de cómo queda con y sin sellos puestos. La imagen del sello ya existe
(spec 0026); esta feature agrega el resto del aspecto visual de la tarjeta.

## Alcance

**Entra:**

- Convertir el **flujo de creación** del programa en un wizard por pasos, con navegación
  adelante/atrás y validación por paso. Aplica a Puntos y a Sellos.
- **Puntos** — pasos:
  1. Nombre de las unidades (singular / plural).
  2. Términos y condiciones.
  3. Preview + Activar.
- **Sellos** — pasos:
  1. Nombre del sello + cantidad de sellos (objetivo 2–50).
  2. **Diseño de la tarjeta**:
     - Color(es) de **fondo** de la tarjeta (NO el recuadro donde va el sello): uno o dos
       colores combinados en **degradé** (si es uno solo, sin degradé).
     - **Color de borde** de los recuadros de los sellos (los recuadros tienen fondo blanco).
     - Upload de la **imagen del sello** (reutiliza el pipeline de la spec 0026).
     - **Preview en vivo** de la tarjeta con los colores elegidos y algunos sellos puestos
       (recuadros llenos vs. vacíos).
  3. Términos y condiciones.
  4. Preview + Activar.
- Persistir el diseño de la tarjeta (colores) además de la imagen del sello ya existente.
- Componente de **tarjeta reutilizable** que renderiza el fondo (con/sin degradé), los N
  recuadros (llenos/vacíos, con el color de borde y fondo blanco) y la imagen del sello.

**No entra (a confirmar):**

- Rediseñar el **flujo de edición** de un programa activo (esta spec es sobre creación; la
  edición puede seguir con el editor actual o reusar los pasos — decidir en «Abierto»).
- El wallet consumer que consumirá la tarjeta (spec propia).
- Animaciones de la tarjeta, plantillas de diseño predefinidas, temas.

## Modelo de datos (propuesta, a confirmar)

Nuevos campos de diseño de tarjeta en `core.loyalty_program` (sólo Sellos; nullables):

```text
card_background_color      #RRGGBB (fondo 1)
card_background_color_2?    #RRGGBB (fondo 2 para degradé; null = sin degradé)
card_border_color          #RRGGBB (borde de los recuadros del sello)
```

- Alternativa: un único `card_design` jsonb. La spec 0026 promovió el sello a columnas; seguir
  ese criterio (columnas) da constraints de patrón `#RRGGBB` en Drizzle y queries simples.
- Validación server: colores `#RRGGBB` normalizados a mayúsculas; degradé opcional.
- Requiere migración Drizzle aditiva + verificación en Neon (rama efímera) + aplicar a prod.

## UI / Wizard

- Un contenedor de wizard con estado de paso, barra de progreso, botones Atrás/Siguiente y,
  en el último paso, Preview + Activar. Reutiliza toasts/skeleton existentes.
- La modalidad (Puntos/Sellos) se elige antes del paso 1 (o es el paso 0), como hoy.
- El preview de la tarjeta es un componente compartido (`CardPreview`) que se usa en el paso de
  diseño (vivo) y en el paso final. Pensado para reutilizarse luego en el wallet consumer.
- Consistencia visual con el resto del editor (paneles `loyalty-panel`).

## Plan production-grade (borrador)

1. Cerrar «Abierto» con el owner (modelo de datos, degradé, edición, límites de color).
2. Migración de columnas de diseño + validación server (patrón de color, degradé opcional).
3. `CardPreview` compartido; wizard de creación para Puntos y Sellos con validación por paso.
4. Integrar con `saveProgram` (los colores viajan en el payload de creación/edición).
5. Pruebas: unit de validación de color/degradé; integración Neon de persistencia; el preview
   se verifica con QA manual en vivo. Revisor independiente antes de `implementada`.

## Definition of Done (borrador)

- [ ] La creación de Puntos usa el wizard de 3 pasos descrito; la de Sellos, el de 4 pasos.
- [ ] En Sellos se eligen fondo (1 o 2 colores en degradé) y color de borde; se persisten.
- [ ] El preview muestra la tarjeta con los colores y con sellos llenos/vacíos, en vivo.
- [ ] La API valida los colores (`#RRGGBB`) y el degradé; `422` ante inválido.
- [ ] Migración aplicada/verificada en Neon; unit + integración + build verdes.
- [ ] PASS de revisor independiente.

## Abierto (resolver con el owner antes de implementar)

- **Modelo de datos**: ¿columnas (`card_background_color`, `..._2`, `card_border_color`) o un
  `card_design` jsonb? (Propuesta: columnas, siguiendo 0026.)
- **Degradé**: ¿dirección fija (p.ej. vertical/diagonal) o configurable? ¿Sólo lineal?
- **Edición**: ¿el flujo de edición de un programa activo también pasa a wizard, o queda con el
  editor actual?
- **Cantidad de sellos en el preview**: ¿cuántos «puestos» de ejemplo se muestran (p.ej. la
  mitad del objetivo)?
- **Defaults de color**: valores iniciales (¿derivados de la marca del negocio — colores de
  `business` de la spec 0025 — o fijos?).
- **Puntos**: ¿tiene alguna personalización visual futura, o su wizard es sólo unidades + TOS +
  activar como se listó?
