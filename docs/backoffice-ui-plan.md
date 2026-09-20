# Plan de trabajo — shell del backoffice

Fecha: 2026-09-19

## Objetivo

Rediseñar la navegación y la portada del backoffice para pequeños negocios. La
experiencia debe sentirse cercana, clara y cuidada: no como un ERP corporativo,
pero tampoco como una plantilla administrativa genérica. Las pantallas internas
y sus contratos quedan fuera de este alcance.

## Arquitectura de información

- **Inicio**: base del futuro dashboard; hoy presenta contexto, orientación y
  accesos sin inventar estadísticas.
- **Mi negocio**: Marca, Locales, Staff y Catálogo.
- **Fidelización**: Programa de fidelización y Campañas.
- **Cuenta**: Suscripción y cierre de sesión.
- **Mostrador**: herramienta operativa siempre accesible mediante un botón
  diferenciado, sin convertirla en la acción principal del Inicio.

Staff permanece visible como parte de la arquitectura, pero se marca como
próximo mientras no exista una ruta real. No se crea una pantalla ficticia.

## Comportamiento responsive

### Móvil

- Barra inferior alcanzable con una mano.
- Inicio y Mostrador son enlaces directos.
- Mi negocio, Fidelización y Más abren paneles breves con sus destinos.
- Áreas táctiles de al menos 44 px, etiquetas visibles y foco perceptible.
- Espacio inferior reservado para que la barra no tape el contenido.

### Escritorio

- Barra lateral persistente con las áreas agrupadas y el destino activo.
- Botón de Mostrador separado visualmente del menú habitual.
- Contenido con ancho legible, sin extender formularios o tarjetas de borde a
  borde en pantallas grandes.

## Dirección visual

- Fondo blanco cálido/verdoso basado en los tokens del wizard.
- Verde como estructura y orientación; naranja reservado para acentos puntuales.
- Superficies suaves, iconografía consistente y elevación discreta.
- Jerarquía tipográfica editorial y composiciones variadas, evitando una grilla
  de tarjetas idénticas.
- Lenguaje orientado a tareas del dueño, no a conceptos administrativos.

## Implementación

1. Crear un layout compartido para `/backoffice/*`.
2. Incorporar navegación adaptativa con estado activo y acceso persistente a
   Mostrador.
3. Mantener una versión reducida y segura para el rol staff, que solo opera el
   Mostrador.
4. Rediseñar Inicio como una base honesta para el futuro dashboard.
5. Reutilizar rutas, autorización y datos existentes; no modificar interiores.
6. Verificar tipos, contraste, teclado y anchos móvil/escritorio.

## Criterios de aceptación

- Todos los módulos existentes son alcanzables desde la navegación adecuada.
- Mostrador está disponible desde cualquier pantalla del backoffice.
- El owner entiende la agrupación sin conocer la estructura del sistema.
- Staff no recibe accesos de owner.
- Inicio no presenta estadísticas ni estados de negocio inventados.
- La interfaz funciona desde 320 px y escala a escritorio.
- La navegación tiene nombres accesibles, estado activo y foco visible.

