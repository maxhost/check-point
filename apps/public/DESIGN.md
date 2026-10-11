---
name: CheckPass Club — Funcional
description: Claridad al leer, demostraciones contenidas y calidez mediante acentos puntuales.
colors:
  ink: "#17382f"
  paper: "#ffffff"
  muted: "#52685f"
  accent: "#386a58"
  line: "#dce6e1"
  panel: "#f5f8f6"
  plan-accent: "#9b432c"
  plan-wash: "#fffaf7"
  plan-border: "#e8cbbb"
  selection: "#d7e4d6"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "59px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "37px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: "7px"
  demonstration: "9px"
spacing:
  compact: "12px"
  normal: "24px"
  page: "48px"
  section: "65px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "13px 21px"
  demonstration:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.demonstration}"
    padding: "22px"
  plan-highlight:
    backgroundColor: "{colors.plan-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "28px"
---

# Design System: CheckPass Club

## Overview

**Creative North Star: "Funcional con calidez"**

La información conduce la experiencia. La jerarquía permite reconocer el beneficio,
leer su explicación y encontrar la acción. Las fotografías y demostraciones tienen
un espacio propio; acompañan el mensaje sin actuar como fondo del texto principal.

La calidez procede del contexto de comercios locales y de acentos puntuales. El
verde organiza y el terracota destaca una elección concreta. La página tiene un
ritmo estable, con espacio entre temas y agrupación estrecha dentro de cada tema.

**Key Characteristics:**

- Texto e imágenes separados.
- Jerarquía consistente y lectura fácil de recorrer.
- Demostraciones delimitadas y listas verticales.
- Color de acento selectivo.
- Interacciones reconocibles y navegación real.

Diseño aprobado por el owner el2026-10-11; aplicado inicialmente a `/negocios`
en la spec0200. Es la referencia para revisar después las demás páginas de esta
app. La spec0201 adopta esta filosofía en el cuerpo de la home y su footer:
pasos compactos, demostración de pase, recompensa ilustrativa, acceso comercial
contenido y FAQ. El header y el hero de consumidores son una excepción aprobada:
se conservan exactamente con sus estilos, imagen y notificaciones anteriores.
La spec0203 adopta Funcional en `/marketing-para-comercios`: mensajes centrados
en atraer clientes y promover el regreso, campañas por audiencia y demostraciones
de condición y beneficio. La spec0204 adopta Funcional en fidelización: reglas
de acumulación explícitas, previsión sin promesas de ganancia, historial útil y
programas independientes. Punto de venta conserva sus estilos anteriores. Esta guía no sustituye el kit de `apps/merchant`.

## Colors

Verde profundo para texto y acciones, superficies claras y un acento cálido
reservado para énfasis deliberados. Los valores normativos están en el frontmatter.

### Primary

- **Verde profundo** (`ink`): texto principal, acciones primarias y cierre comercial.
- **Verde medio** (`accent`): énfasis dentro de titulares, sin teñir todo el contenido.

### Secondary

- **Terracota** (`plan-accent`): precio de Conecta y foco visible.
- **Marfil cálido** (`plan-wash`) y **borde cálido** (`plan-border`): conjunto de
  énfasis de Conecta. Impulso mantiene el tratamiento neutral aprobado.

### Neutral

- **Blanco** (`paper`): fondo y superficies de lectura.
- **Verde tenue** (`panel`): demostraciones, pasos y información agrupada.
- **Texto secundario** (`muted`): notas y metadatos.
- **Línea suave** (`line`): separadores y límites de paneles.

**The Acento selectivo Rule.** Usar el color cálido para un énfasis identificado;
no convertir cada bloque ni cada icono en otro reclamo visual.

Oscuro conserva la composición y adapta los roles mediante las variables de CSS:
fondo verde profundo, texto claro, superficies verdes y destacado cálido de Conecta.
No copiar un fondo blanco literal a una superficie que debe adaptarse al tema.

## Typography

**Display Font:** Arial con Helvetica y sans-serif como alternativas, según el
prototipo aprobado. **Body Font:** la misma familia.

Titulares en negrita, texto normal y énfasis de color sin otra voz tipográfica.
La escala describe lo implementado, no impone el mismo tamaño a cualquier pantalla.

- Display:59px desktop y41px móvil, interlineado1.12; ancho de15ch en el hero.
- Headline:37px; planes, inicio y cierre tienen variantes compactas.
- Title:21px; pasos18px.
- Body:17px, interlineado1.65 y ancho máximo65ch.
- Enlaces secundarios y navegación:14px. Notas comerciales:12px.

El mock POS lleva textos demostrativos de10–13px: es una excepción de la
ilustración, no el tamaño recomendado para tareas, formularios o información
esencial de otras páginas. Al revisar estas, medir legibilidad en su contexto.

## Layout

Contenedor de1190px con48px laterales,24px en móvil. Los bloques explicativos
usan dos columnas en escritorio; a760px o menos pasan a una, con texto antes de
su imagen. El espacio habitual entre temas es65px; en móvil45px. Los grupos
internos se separan con12–28px según función.

**The Separación legible Rule.** La explicación y la acción viven fuera de la
fotografía. Las imágenes muestran contexto o funcionamiento dentro de un panel.

Esta filosofía no obliga a repetir el hero de dos columnas en todas las páginas.
Al revisar otra superficie, organizar primero sus tareas y contenido; aplicar
después la jerarquía, el ritmo y el lenguaje visual aquí registrados.

## Elevation & Depth

Superficies planas; sin sombras decorativas. Fondos tenues, bordes finos y espacios
definen la agrupación. El foco visible usa contorno cálido de3px con separación5px.

## Shapes

Controles y planes con esquinas de7px; demostraciones de9px. Bordes de1px.
Los recortes fotográficos son rectangulares y conservan el contenido relevante.

## Components

### Buttons

Acción primaria verde, texto claro, padding13px21px. Enlaces informativos
subrayados. Hover reduce opacidad sin desplazar el control; foco siempre visible.
El cierre oscuro utiliza una acción clara. Los CTA apuntan a sus destinos reales.

### Demonstrations

Imagen y explicación contextual dentro de una superficie tenue. No superponer
tarjetas flotantes al texto principal. Conservar textos como HTML y recursos
fotográficos separados. Un elemento ilustrativo no debe presentarse como un
control de la página.

### Plans

Dos planes lado a lado en escritorio, apilados en móvil. Ítems en una sola
columna, nombre y precio antes de las características. Solo Conecta tiene el
destacado cálido aprobado; Impulso queda neutral. Sin corazones ni etiquetas
inventadas de popularidad o recomendación. Notas y condiciones siguen visibles.

### Questions

Preguntas desplegables mediante details/summary nativos. Icono discreto de
apertura, foco visible y operación con teclado. Sin animación al pedir movimiento
reducido. Las respuestas comerciales se conservan completas.

### Navigation

Marca real, enlaces descriptivos y una acción primaria. Menú desktop oculto a760px;
en móvil permanecen marca y CTA, con accesos adicionales dentro del contenido
y footer. Legales y destinos reales conservados.

## Do's and Don'ts

### Do:

- **Do** separar titulares, explicaciones y acciones de las fotografías.
- **Do** agrupar información relacionada y dejar espacio entre temas distintos.
- **Do** utilizar un acento para una prioridad concreta.
- **Do** mantener listas de características verticales y condiciones visibles.
- **Do** verificar orden móvil, foco y contraste en ambos temas.

### Don't:

- **Don't** convertir cada sección en una composición publicitaria autónoma.
- **Don't** competir por atención con iconos, etiquetas y colores simultáneos.
- **Don't** inventar testimonios, recomendaciones o cifras para llenar el diseño.
- **Don't** copiar el layout completo a otra página sin revisar sus tareas.
- **Don't** usar el texto pequeño del mock POS como regla para contenido esencial.
