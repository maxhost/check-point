# Investigación UX mobile-first — CheckPass Club

Fecha: 17 de septiembre de 2026  
Alcance: interfaz B2B para una persona que administra un comercio, con uso frecuente de pie, en el mostrador, con interrupciones y con una sola mano. Esta investigación fija criterios para el sistema de diseño y el wizard de alta; no define contratos de API.

## 1. Uso mobile-first en el mostrador

### Contexto y principio rector

El contexto no es “mobile” solamente por el ancho de pantalla: la persona alterna entre atender, cobrar y operar el producto. La interfaz debe tolerar atención parcial, agarres variables, errores de toque e interrupciones. La evidencia de campo citada por trabajos de HCI encontró que el 49% de las personas observadas usaba el teléfono con una mano y el pulgar; otros agarres también cambian qué parte de la pantalla resulta alcanzable. La “thumb zone” es, por lo tanto, una guía ergonómica y no una geometría universal: depende de mano dominante, tamaño del dispositivo y agarre ([Ng, tesis doctoral, University of Glasgow](https://theses.gla.ac.uk/7185/1/2016ngphd.pdf); [estudio sobre rendimiento motor del pulgar, PubMed](https://pubmed.ncbi.nlm.nih.gov/22409102/)).

Para CheckPass esto implica:

- La acción primaria de cada vista se ubica al final del flujo y, en móvil, cerca del borde inferior. No se colocan acciones destructivas o irreversibles pegadas a la acción primaria.
- No se depende de alcanzar una esquina superior para completar una tarea. Atrás, ayuda y cierre pueden estar arriba porque son secundarios, pero también deben ser alcanzables por navegación del sistema y teclado.
- Las acciones frecuentes tienen etiqueta textual; un icono solo no debe exigir memoria ni precisión.
- Una barra inferior fija reserva espacio de contenido equivalente y respeta `safe-area-inset-bottom`, para no tapar el último campo ni el foco. WCAG 2.2 exige que el foco no quede oculto por contenido creado por la aplicación ([W3C, novedades de WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)).

### Áreas táctiles y separación

WCAG 2.2 AA fija un mínimo de 24 × 24 CSS px o una separación equivalente, con excepciones. Apple recomienda una región de toque de al menos 44 × 44 pt. Son criterios distintos: el primero es un piso de conformidad web; el segundo es una recomendación ergonómica de plataforma ([W3C, Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); [Apple HIG, Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).

**Decisión:** CheckPass adopta **44 × 44 CSS px como mínimo de área interactiva** y **48 px de alto para controles principales de formulario**. El gráfico o icono puede medir 20–24 px, pero su región activable mantiene 44 × 44 px. Entre controles adyacentes habrá al menos 8 px. No usaremos las excepciones de WCAG para achicar controles de producto; se reservan para enlaces dentro de texto o controles nativos inevitables.

### Jerarquía tipográfica y lectura

La jerarquía será corta y estable: un `h1` por pantalla, `h2` para secciones, etiqueta visible por campo, ayuda breve y texto de estado. El cuerpo móvil parte de 16 CSS px para evitar zoom y conservar legibilidad; etiquetas y mensajes no bajan de 14 px; títulos usan una escala contenida (aproximadamente 24/20 px en móvil) para no desplazar la tarea debajo del primer viewport. El interlineado será de 1.4–1.6 en texto corrido y nunca se bloqueará el zoom. La estructura semántica, no el tamaño visual, determina la jerarquía para lectores de pantalla.

WCAG requiere que el texto pueda ampliarse y que el contenido vertical refluya hasta un viewport equivalente a 320 CSS px sin pérdida ni scroll en dos dimensiones, salvo contenido intrínsecamente bidimensional como una tabla ([W3C, Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).

### Formularios largos en pantallas chicas

- Dividir por intención, no por cantidad arbitraria de campos. Una pantalla pregunta una cosa o un grupo pequeño y coherente.
- Usar etiquetas persistentes sobre el campo; el placeholder solo muestra formato o ejemplo y nunca reemplaza a la etiqueta.
- Elegir teclado y autocompletado adecuados (`inputmode`, `type`, `autocomplete`) y no pedir dos veces lo ya conocido.
- Mantener valores al volver y después de un error. WCAG 2.2 pide que la información ya ingresada en el mismo proceso se complete automáticamente o quede disponible para seleccionar ([W3C, Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)).
- Mostrar ayuda antes de que haga falta, pegada al campo, en una frase corta. Las reglas complejas se explican antes de enviar.
- Botón principal de ancho completo en móvil y visible al terminar el contenido; si se vuelve fijo, no tapa contenido ni teclado.
- No deshabilitar “Continuar” solo para ocultar qué falta: permitir el intento, explicar el error y llevar el foco al primer campo inválido.

GOV.UK recomienda comenzar con una pregunta por página, incluir una forma explícita de volver, no pedir la misma información otra vez y preservar el estado al retroceder ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)). CheckPass agrupará campos estrechamente relacionados cuando separarlos aumente los pasos sin reducir carga cognitiva.

### Carga, éxito, vacío y error

- Una acción enviada cambia de inmediato a estado ocupado: conserva su ancho, muestra texto específico (“Guardando negocio…”) y evita envíos duplicados. No se usa un spinner sin nombre accesible.
- Para esperas breves se mantiene el contenido estable; para carga inicial se usa un esqueleto que replica la estructura, sin animación cuando se pide movimiento reducido. No se reemplaza toda la pantalla por un spinner si parte del contenido ya está disponible.
- El éxito se confirma en contexto con texto, no solo color o un toast fugaz. Los mensajes que no mueven el foco usan una región `role="status"`; errores urgentes posteriores a una acción pueden usar `role="alert"`. WCAG requiere que los cambios de estado sean programáticamente determinables sin forzar el foco ([W3C, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)).
- Los errores de campo aparecen junto al campo, describen qué ocurrió y cómo corregirlo, se vinculan mediante la descripción accesible y no borran lo escrito. En un envío con varios errores se añade un resumen al inicio y el foco va al resumen o al primer campo inválido según la escala del formulario. Un borde rojo solo no alcanza ([W3C, Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification); [GOV.UK, Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/)).
- Los errores de red conservan los datos y ofrecen “Reintentar”. Los errores de autorización o estado del negocio explican el bloqueo con la acción disponible, sin prometer una solución que la API no soporte.
- Un estado vacío explica qué falta, por qué importa y ofrece una sola acción siguiente. No se presenta como error.

## 2. Wizard de alta de tres pasos

### Estructura y progreso

Un indicador de pasos es apropiado porque el alta tiene exactamente tres capítulos, orden lineal y final definido. USWDS recomienda este patrón para procesos de tres o más pasos, separa el indicador de la navegación y exige un encabezado explícito por pantalla ([USWDS, Step indicator](https://designsystem.digital.gov/components/step-indicator/)).

**Decisión:** se mostrará siempre “Paso N de 3” y el nombre corto del paso. En móvil se prioriza contador + barra compacta; desde el ancho donde entren sin envolver, se ven también los tres nombres. El paso actual lleva texto y `aria-current="step"`; completado y pendiente no se distinguen solo por color. El indicador informa, **no navega**: volver y continuar son controles separados. La posición del indicador será idéntica en los tres pasos.

Aquí hay una tensión entre fuentes: GOV.UK aconseja probar primero sin indicador y advierte que indicadores complejos pueden pasar inadvertidos, mientras USWDS lo recomienda desde tres pasos. Elegimos mostrarlo porque el total es pequeño, fijo y el encargo ya define un wizard; usamos la variante textual simple de GOV.UK, no una navegación clickeable compleja ([GOV.UK, Question pages](https://design-system.service.gov.uk/patterns/question-pages/); [USWDS, Step indicator](https://designsystem.digital.gov/components/step-indicator/)).

### Validación

- Validación ligera al salir de un campo solo cuando la regla es inequívoca y la persona ya interactuó; nunca mostrar error al enfocar por primera vez.
- Validación completa al pulsar “Continuar”, **por paso**. No se permite avanzar con datos que impidan crear correctamente el recurso de ese paso.
- Los errores devueltos por la API mandan sobre cualquier inferencia cliente. Se traducen a mensaje accionable sin perder el código para diagnóstico.
- Al volver, los datos permanecen y se pueden editar. La pantalla final revisa el resultado creado; no posterga hasta el final errores que podían resolverse en su paso.

La validación inline bien aplicada reduce esfuerzo, pero una implementación prematura o agresiva también genera fricción; la evidencia de pruebas de formularios respalda validar en contexto y conservar mensajes cerca del campo ([Baymard, Inline Form Validation](https://baymard.com/research-articles/inline-form-validation)).

### Cierre, interrupción y reanudación

La opción ideal es guardar automáticamente cada paso confirmado en servidor. Si la API no permite persistir un borrador antes de crear el recurso correspondiente, se guardará localmente solo información no sensible y se restaurará al regresar; esto deberá verificarse contra los contratos en la Fase 1. GOV.UK recomienda guardar automáticamente las respuestas mientras se avanza en formularios complejos ([GOV.UK Service Manual, Structuring forms](https://www.gov.uk/service-manual/design/form-structure)).

**Decisión:**

- Al completar un paso, se persiste antes de avanzar y se anuncia “Progreso guardado”.
- Al cerrar con cambios aún no persistidos, se muestra confirmación solo si realmente se perderían datos; no interrumpir con una alerta si todo ya está guardado.
- Al volver, se ofrece “Continuar alta” desde el último paso incompleto, con campos prellenados. Nunca se crea silenciosamente un segundo negocio o programa.
- El borrador local tendrá versión y vencimiento; no contendrá PIN, secretos ni datos de autenticación. Se elimina tras completar el alta.
- Si los contratos no exponen un modo seguro de consultar/reanudar el estado, se documentará la carencia en `docs/api-faltante.md` en vez de inventar una ruta.

## 3. Accesibilidad: WCAG 2.2 AA como piso

### Contraste y uso del color

- Texto normal: mínimo 4.5:1; texto grande: 3:1. Controles, bordes necesarios, iconos informativos y foco: mínimo 3:1 contra colores adyacentes. Los pares reales —incluidos hover, pressed, dark mode y marca inyectada— se validan al definir tokens ([WCAG 2.2, criterios 1.4.3 y 1.4.11](https://www.w3.org/TR/WCAG22/)).
- Color nunca es la única señal: error incluye icono/texto, paso actual incluye texto/semántica y éxito incluye mensaje.
- Los colores editables del comercio no se aplican directamente a texto o superficies críticas: pasan por roles/tokens con un color de contenido que garantice contraste o caen a un tono seguro.

### Foco, teclado y estructura

- Todo control es alcanzable y operable por teclado, en orden equivalente al orden visual y de lectura. No se usan `tabindex` positivos.
- El foco visible será un contorno sólido de al menos 2 CSS px, separado del componente y con contraste mínimo 3:1. Aunque la métrica reforzada de apariencia de foco es AAA, se adopta como criterio de producto ([W3C, Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)).
- Al cambiar de paso, el foco va al `h1` o al contenedor principal con anuncio del nuevo paso; ante error, al resumen o primer error; al abrir modal/sheet, queda atrapado dentro y vuelve al disparador al cerrar.
- Ninguna barra fija tapa el foco. Escape cierra overlays descartables, pero no ejecuta acciones destructivas.
- Se usan elementos y relaciones semánticas: `main`, headings ordenados, `form`, labels, fieldsets/legends, botones reales y listas. El DOM conserva el mismo orden significativo entre breakpoints.

### Lectores de pantalla y movimiento

- Cada control tiene nombre, rol, estado y descripción programáticos. Los iconos decorativos se ocultan; los funcionales acompañan una etiqueta visible o nombre accesible inequívoco.
- Carga, guardado, resultado y error dinámicos se anuncian de forma breve. No se hacen regiones vivas sobre contenedores grandes porque repetirían toda la pantalla.
- El indicador dice paso actual, total y estado de completitud; la barra puramente visual se oculta a tecnología asistiva.
- Con `prefers-reduced-motion: reduce` se eliminan desplazamientos, zooms, parallax, pulsos y animaciones de esqueleto; se conservan cambios instantáneos de estado. Esta preferencia está disponible ampliamente y representa una solicitud explícita del sistema operativo ([MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)).
- Pruebas mínimas: teclado solamente; VoiceOver + Safari; NVDA + Firefox/Chrome; zoom 200% y reflow equivalente a 320 CSS px; modo claro/oscuro; reducción de movimiento; contraste automatizado y revisión manual.

## 4. Escalar a desktop sin rediseñar

Los breakpoints se eligen cuando el contenido deja de funcionar, no por nombres de dispositivos. web.dev recomienda empezar por el ancho chico, expandir y añadir el mínimo de cortes que el contenido exija ([web.dev, Responsive web design basics](https://web.dev/articles/responsive-web-design-basics)).

### Breakpoints de partida

Son hipótesis que se validarán con contenido real y zoom, no contratos rígidos:

| Rango | Intención | Cambio permitido |
| --- | --- | --- |
| `< 640px` | teléfono / una mano | una columna, acciones de ancho completo, navegación inferior, sheet desde abajo, listas apiladas |
| `640–1023px` | ancho intermedio | más aire, dos columnas solo para pares cortos, modal centrado si cabe, navegación rail o sidebar compacta según cantidad de destinos |
| `≥ 1024px` | escritorio | sidebar persistente, contenido con ancho máximo legible, formularios sin estirarse, tabla para comparación densa |
| `≥ 1280px` | escritorio ancho | más margen o panel complementario; no agrandar indefinidamente líneas ni controles |

Material describe el mismo intercambio de componentes —barra inferior en ancho chico, rail en tablet y drawer en pantallas grandes— y sitúa el primer cambio adaptativo alrededor de 600 dp; CheckPass usa 640 CSS px por alineación con la escala de Tailwind y deberá cambiarlo si el contenido rompe antes ([Material Design, Navigation drawer and component swapping](https://m2.material.io/components/navigation-drawer/flutter/1000)).

### Patrones que cambian, tarea que permanece

- **Bottom nav → sidebar:** mismos destinos, orden, nombres e iconos. En móvil se muestran solo 3–5 destinos primarios; lo secundario vive en “Más”. En desktop se revela, no se inventa otra arquitectura.
- **Sheet → modal:** la misma acción y contenido. En móvil entra desde abajo y aprovecha el ancho; en desktop se centra con ancho máximo. Foco, cierre y semántica de diálogo son idénticos.
- **Lista → tabla:** en móvil cada registro muestra los datos necesarios para reconocerlo y actuar; detalles secundarios se expanden o van a detalle. En desktop una tabla aparece solo cuando comparar columnas aporta valor. No se comprime una tabla completa hasta volverla ilegible.
- **Acción inferior → acción junto al encabezado:** puede cambiar de posición visual, pero no su prioridad ni etiqueta. El orden DOM seguirá siendo lógico para lectura y teclado.
- **Wizard:** conserva una columna de formulario de ancho legible en desktop; no convierte los tres pasos en un único formulario ni agrega campos en paralelo solo porque sobra espacio.

## Decisiones explícitas para CheckPass

1. Diseñar desde 320 CSS px y validar reflow, aunque el dispositivo objetivo típico sea más ancho.
2. Usar 44 × 44 CSS px como mínimo táctil y 48 px para controles principales; WCAG 24 px es piso de conformidad, no objetivo ergonómico.
3. Ubicar la acción primaria móvil en la zona inferior alcanzable, con espacio seguro y sin cubrir foco o contenido; no asumir mano derecha.
4. Adoptar cuerpo de 16 px, ayudas/errores de al menos 14 px, jerarquía semántica corta y ancho de lectura limitado.
5. Dividir el alta en tres pasos lineales, mostrar siempre “Paso N de 3” y usar el indicador como información, no navegación.
6. Validar reglas inequívocas después de interacción y validar completamente al continuar cada paso; conservar siempre los datos ante error.
7. Guardar al completar cada paso y reanudar en el último incompleto. Si la API no permite hacerlo sin inventar una ruta, registrar la falta y limitar la persistencia local a datos no sensibles.
8. Explicar cargas, éxitos y errores con texto y semántica accesible; nunca depender solo de spinner, color, icono o toast.
9. Cumplir WCAG 2.2 AA y adoptar además foco de 2 px/3:1 como criterio interno. Probar teclado y lectores de pantalla, no solo auditoría automática.
10. Respetar `prefers-reduced-motion` eliminando movimiento no esencial y animación de esqueletos.
11. Partir de 640 y 1024 px como cortes de implementación, pero moverlos si el contenido real lo exige. Los breakpoints responden a contenido, no a modelos de dispositivo.
12. Cambiar el contenedor al escalar —bottom nav/sidebar, sheet/modal, lista/tabla— sin cambiar la tarea, vocabulario, orden semántico ni contratos.
13. No aplicar colores de marca del comercio sin una capa de tokens que garantice contraste; una marca inválida cae a combinaciones seguras.
14. Tratar el uso en mostrador como escenario de interrupción: estados recuperables, acciones inequívocas, sin pérdida silenciosa ni duplicación de recursos.

