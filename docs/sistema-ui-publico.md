# Sistema UI/UX público de CheckPass Club

Estado: referencia de la implementación actual, 30 de septiembre de 2026. Alcance: landing de negocios `/`, exploración `/explorar` y fichas de ejemplo `/lugares/[slug]` en `apps/public`. El aspecto del alta se documenta en `sistema-visual-checkpass.md`; el backoffice merchant mantiene su sistema operativo.

## Intención

CheckPass se presenta como una guía local para descubrir lugares y volver a ellos. La portada prioriza el lugar, la fotografía y la información necesaria para decidir una visita; la recompensa acompaña esa decisión. La landing de negocios usa el mismo lenguaje visual para explicar el producto y llevar al alta. El tono es cercano, claro y adulto: menos elementos decorativos, más espacio, jerarquía tipográfica y señales reales de contexto local.

Las referencias de exploración y experiencias, como Airbnb, orientaron la densidad de tarjetas, el uso de fotografía y la jerarquía de la ficha. Son referencias de patrón, no una plantilla para copiar. CheckPass mantiene su propuesta propia: descubrir comercios de la ciudad y dar motivos para regresar.

## Fundamentos visuales

| Rol | Valor actual | Uso |
| --- | --- | --- |
| Tinta / acción principal | `#1d332c` | Títulos, texto destacado, botones sólidos, foco de tarjetas |
| Papel cálido | `#faf9f5` | Fondo general |
| Blanco | `#ffffff` | Superficies y contraste sobre la tinta |
| Texto secundario | `#627168` | Descripciones y metadatos |
| Línea | `#d9dfd7` | Separadores y bordes discretos |
| Acento terracota | `#a55a43` | Palabras acentuadas, cejas y detalles puntuales |
| Superficie verde suave | `#eff2ed` | Bloques alternos de la landing de negocios |
| Verde suave adicional | `#d9e5d8` | Acentos secundarios de la landing de negocios |

La tipografía pública usa `Arial, Helvetica, sans-serif`. Los títulos son pesados, con espaciado ajustado (`letter-spacing: -0.055em`) y líneas cortas; el acento cambia de color sin convertirse en otra fuente ni en cursiva visual. Las cejas son pequeñas, en mayúsculas y con espaciado amplio. El cuerpo conserva una lectura cómoda, con color atenuado y altura de línea generosa.

La composición usa un ancho máximo de `1440px`, márgenes laterales amplios, mucho espacio entre secciones y líneas finas para ordenar. Botones y contenedores tienen radios pequeños. El movimiento es discreto, como el leve acercamiento de una foto al pasar el cursor, y respeta `prefers-reduced-motion`. Evitar ilustraciones caricaturescas, iconos grandes sin función, tarjetas infladas y efectos flotantes que compitan con el contenido.

Estos valores describen el código actual: están repetidos entre `apps/public/src/app/explore/explore.css` y `apps/public/src/app/negocios/negocios.css`; todavía no hay un archivo central de tokens públicos. Al extender el sistema, conviene consolidar los roles antes de introducir variantes.

## Patrones por página

### Exploración `/explorar`

- Hero editorial con texto a la izquierda y fotografía local de Cuenca a la derecha. El primer CTA lleva al catálogo; la navegación permite pasar a `/`.
- Catálogo de tarjetas compactas y fotográficas: cuatro columnas en escritorio, tres en pantallas intermedias, dos en móvil habitual y una en pantallas muy estrechas. Cada tarjeta muestra categoría, nombre, zona, horario y beneficio de ejemplo. La acción «Ver todas las opciones» despliega el resto del mock.
- Búsqueda, categoría y filtro «Abierto ahora» ayudan a descubrir con datos entendibles. La hora se interpreta en `America/Guayaquil`.
- La UI evita puntuaciones, reseñas y otras señales de confianza que el mock no puede sostener.

### Ficha `/lugares/[slug]`

- Encabezado con nombre, categoría, zona y horario; fotografía protagonista de altura contenida; descripción y beneficio esencial; ubicación con mapa ilustrativo. La foto llega como máximo a `390px` de alto en escritorio.
- La ficha declara que el comercio, sus datos y la imagen son ejemplos. El mapa identifica una zona aproximada y no finge una dirección exacta.
- No convertir la ficha en una página de datos exhaustivos hasta tener información verificable de cada comercio.

### Negocios `/`

- Mantiene la misma tinta verde, papel cálido, acento terracota, tipografía y ritmo editorial. El hero usa fotografía humana y una vista simple del producto. Los pasos, beneficios, campañas, planes y preguntas se presentan con jerarquía clara y superficies sobrias.
- Los CTA de alta llevan a `/es/business/onboarding` mediante `MERCHANT_ONBOARDING_URL`. La ruta de negocios es el puente entre la experiencia pública y el registro.

## Contenido, fotos y estados de ejemplo

Las imágenes actuales son archivos locales procedentes de Pexels, con créditos visibles. `next/image` define tamaños responsivos y prioridad en las imágenes principales. El material del catálogo es un mock funcional: nombres, fotos, horarios y beneficios son ilustrativos y no representan comercios participantes ni promociones vigentes. El aviso de prototipo debe seguir siendo visible hasta publicar datos reales.

Los datos de ejemplo están aislados en `apps/public/src/app/explore/mock-businesses.ts`. Cuando se conecte la base, mapear desde un contrato de publicación pública hacia la misma vista y exigir fotos, horarios, ubicación y beneficios verificables. Mantener estados para dato faltante, sin inventar reseñas, apertura, direcciones u ofertas.

## Rendimiento, SEO y accesibilidad

- `/` y `/explorar` se prerenderizan como HTML estático. La interacción del explorador vive en un componente cliente acotado; el render inicial no depende de una consulta a API.
- La landing y la exploración tienen título, descripción, canonical y Open Graph adecuados a su contenido. El explorador y las fichas ficticias tienen `noindex` y quedan fuera del sitemap. `/negocios` redirige permanentemente a `/`.
- Conservar enlaces y contenido semánticos, encabezados ordenados, texto alternativo útil, navegación por teclado, foco visible, salto al contenido y estados que no dependan solo del color. Revisar contraste al cambiar cualquier tono.
- La optimización para buscadores y respuestas generativas debe apoyarse en contenido verificable, local y legible en HTML; no publicar datos estructurados de comercios ficticios como si fueran reales.

## Relación con el sistema merchant

`docs/design-system.md` documenta el catálogo funcional de `apps/merchant`: tokens semánticos, componentes de formularios, temas claro/oscuro y personalización de marca. Es la referencia para los controles y estados del onboarding y del backoffice. El sistema público de este documento describe la presentación de las páginas de descubrimiento y marketing. Compartir identidad no implica que las tres superficies deban usar el mismo fondo, la misma densidad ni los mismos componentes.

### Continuidad con el alta de negocio

La decisión de diseño para la transición desde la landing `/` al alta está en [`sistema-visual-checkpass.md`](sistema-visual-checkpass.md): identidad compartida, alta como puente y dashboard con composición operativa. La primera adaptación visual del formulario queda acotada a su ruta; mantiene el catálogo de controles y estados merchant.

La QA final debe revisar la pantalla publicada y el recorrido autenticado hasta el dashboard, además de los estados locales de error, claro y oscuro. El cambio visual no modifica `BrandTheme` ni el flujo funcional.

## Fuentes de implementación

- `apps/public/src/app/page.tsx` y `apps/public/src/app/negocios/`: landing para comercios y estilos.
- `apps/public/src/app/explorar/page.tsx` y `apps/public/src/app/explore/`: explorador y estilos.
- `apps/public/src/app/lugares/[slug]/page.tsx`: ficha y mapa ilustrativo.
- `apps/public/src/app/site-config.ts`: destinos y origen público.
- `apps/public/README.md`: comportamiento del mock y variables de entorno.
- `docs/design-system.md`: sistema funcional de la app merchant.
