# Continuidad visual de CheckPass Club

Estado: decisión de diseño para la primera adaptación del alta merchant, 30 de septiembre de 2026.

## Decisión

CheckPass comparte una identidad reconocible entre la web pública, el alta de negocios y el dashboard merchant. Cada superficie adapta la densidad y la composición a su tarea. La transición `/` (landing de negocios) → `/es/business/onboarding` debe ser visualmente continua; el dashboard conserva su estructura operativa.

| Elemento | Regla común | Aplicación por superficie |
| --- | --- | --- |
| Identidad | Mostrar el símbolo y nombre `checkpass.club` de forma consistente. | La web puede darle mayor protagonismo; en el alta identifica el servicio sin competir con el formulario. |
| Tipografía | Arial/Helvetica y jerarquías legibles. | La web usa títulos editoriales grandes; el alta y dashboard usan tamaños ajustados a formularios y datos. |
| Color | Verde oscuro `#1d332c`, papel `#faf9f5` y terracota `#a55a43` identifican la expresión pública. | En el alta se aplican al marco y a las acciones principales. Los estados semánticos de error, éxito, foco y deshabilitado siguen el catálogo funcional merchant. El dashboard mantiene sus tokens operativos y modo oscuro. |
| Controles | Etiquetas, ayudas, errores, foco visible, tamaños táctiles y progreso mantienen el mismo comportamiento. | La web usa CTA de captación; el alta y el dashboard usan componentes de `apps/merchant/src/ui`. |
| Composición | La tarea determina espacio y densidad. | Fotos y secciones amplias en público; una columna enfocada en el alta; navegación y datos compactos en el dashboard. |

## Alcance de esta iteración

El alta usa una envoltura y una cabecera propias, con colores de marca acotados a su ruta. Conserva los componentes React Aria, la secuencia Cuenta → Negocio → Programa, la restauración del avance, la validación y los estados de error. Los cambios de color del alta no se aplican globalmente a `apps/merchant/src/ui/tokens.css` ni al dashboard. El modo oscuro conserva contraste y controles funcionales.

La implementación pública aún repite valores entre `explore.css` y `negocios.css`. Compartir tokens entre aplicaciones puede venir después de verificar la adaptación; no es requisito para este cambio visual.

## Criterios de revisión

1. Al pasar de la landing `/` al alta, el negocio reconoce la misma marca, fondo y acción principal.
2. En móvil y escritorio se distingue cada paso, sus campos y la acción siguiente sin distracciones.
3. Errores, carga, confirmación, foco y modo oscuro mantienen legibilidad y comportamiento.
4. Al entrar al dashboard, la identidad persiste aunque cambie la densidad de la interfaz.

## Fundamento

- [U.S. Web Design System: continuidad](https://designsystem.digital.gov/design-principles/) distingue continuidad de uniformidad y recomienda adaptar la solución a la misión de cada servicio.
- [Nielsen Norman Group: consistencia y estándares](https://www.nngroup.com/articles/consistency-and-standards/) recomienda patrones reconocibles dentro de una familia de productos.
- [Shopify: diseño visual merchant](https://shopify.dev/docs/apps/design/visual-design) vincula las señales visuales consistentes con flujos de trabajo más fáciles de recorrer.
- [U.S. Web Design System: formularios complejos](https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/) prioriza progreso, ayudas, validación y recuperación en el alta.

Referencias internas: `docs/sistema-ui-publico.md`, `docs/design-system.md`, `apps/public/src/app/negocios/negocios.css` y `apps/merchant/src/ui/tokens.css`.
