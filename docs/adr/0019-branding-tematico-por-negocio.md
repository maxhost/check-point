---
fecha: 2026-08-10
resumen: Cada negocio aporta una identidad visual acotada y accesible dentro de la experiencia, navegación y componentes de Mi Pasaporte.
estado: aceptada
---

# ADR 0019 — Branding temático por negocio y primera experiencia consumer

## Contexto

Mi Pasaporte reúne una red de comercios, pero el primer contacto de una persona puede
ocurrir frente al QR de un local sin que conozca el producto ni tenga una cuenta. Al abrir
ese QR, la experiencia debe comunicar tanto el contexto y la personalidad del comercio
como la confianza, estructura y continuidad de Mi Pasaporte.

Permitir que cada comercio cambie arbitrariamente la interfaz con CSS, plantillas o
scripts propios rompería navegación, contraste, accesibilidad y la comprensión de que los
beneficios viven en una misma cuenta. Por el contrario, usar sólo la marca de plataforma
ocultaría al comercio que motivó el check-in.

## Decisión

Mi Pasaporte conserva el sistema de interacción: estructura de las pantallas,
navegación, componentes, tipografía funcional, estados de error/carga, accesibilidad y
seguridad. Cada negocio puede publicar una **identidad visual acotada**, validada y
aplicada dentro de las superficies que le corresponden.

El perfil de branding de un negocio contiene, como mínimo:

- logo y variante de logo accesible;
- imagen de portada opcional;
- nombre de presentación;
- tokens semánticos limitados: color principal, acento y superficies decorativas;
- modo o variantes generadas por el sistema para texto, foco, éxito, advertencia y
  error; esos colores no los controla el comercio directamente.

La configuración no admite CSS, fuentes, JavaScript, HTML, URLs externas sin validar ni
sobrescritura de componentes. Los assets se almacenan y sirven desde infraestructura
controlada, con límites de tamaño/formato y alternativa visible cuando falten, fallen o
no cumplan el control de contraste. El sistema calcula o rechaza combinaciones que no
den contraste suficiente y siempre conserva indicadores de foco y texto legibles.

El branding se aplica a la ficha del comercio, entrada por QR, check-in, resultados de
campaña, beneficios y cupones emitidos por ese negocio. Las pantallas de wallet y
navegación general conservan el marco de Mi Pasaporte; al mostrar activos de un comercio,
usan su identidad como contexto, nunca como sustituto de la fuente de verdad ni de los
estados críticos.

La primera experiencia consumer de v0.1 parte de un QR de local, no de una descarga,
registro ni pantalla de bienvenida previa:

```text
persona sin conocimiento previo
→ cámara escanea QR físico del comercio
→ navegador abre URL del local
→ crea/recupera sesión guest de Mi Pasaporte
→ pantalla de check-in con branding del comercio y contexto claro
→ autorización del check-in
→ Incentive Engine evalúa la campaña activa
→ resultado: puntos, sellos, cupón, crédito u otro activo aplicable
→ cuenta guest y sus beneficios visibles; registro por teléfono es posterior y opcional
```

El check-in sigue requiriendo las defensas y validaciones que se decidan en ADR 0014;
el branding no convierte una lectura de QR en prueba de presencia. La identidad guest se
crea sólo en el momento en que el flujo necesita persistir el check-in o su resultado, y
no debe pedir teléfono antes de entregar el valor prometido por la campaña.

## Consecuencias

- La configuración de negocio incorpora un perfil de marca versionable y auditable; un
  cambio futuro no reescribe la presentación histórica de un cupón o beneficio ya
  emitido si esa presentación debe conservarse.
- La UI se construirá con primitivas accesibles sin estilo (React Aria Components) y
  tokens de diseño propios; Tailwind CSS implementará los estilos. React Spectrum no
  define la apariencia del producto.
- Antes de construir backend se diseña el flujo consumer v0.1 pantalla por pantalla,
  incluidos estados de permiso, fuera de rango, campaña no elegible, repetición,
  conectividad y activos emitidos.
- Se requiere una spec de fundación UI para definir el modelo exacto de tokens, assets,
  contraste, fallback y componentes compartidos antes de implementar pantallas o crear
  un paquete `ui`.
- Owner gestiona el branding de su negocio dentro de permisos y validaciones; staff no
  puede alterar marca ni usarla para modificar las reglas de campaña.
