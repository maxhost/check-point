---
spec: 0191
fecha: 2026-10-10
estado: implementada
resumen: Página pública de programa de fidelización para explicar el producto y permitir QA local.
disjunta: si
archivos: apps/public/src/app/programa-de-fidelizacion/page.tsx, apps/public/src/app/programa-de-fidelizacion/programa.css
---

# 0191 — Programa de fidelización

## Problema

La landing en apps/public/src/app/page.tsx muestra un acceso Descubre sin href porque la página específica no existe. El owner autoriza crearla para explicar el producto y mejorar SEO/GEO.

## Alcance

Entra: una página estática pública en /programa-de-fidelizacion, metadatos propios, CTA al registro existente y enlace a inicio. QR, puntos y sellos, pase digital, acumulación y canje; cashback solo Próximamente.
No entra: API, DB, billing, nuevas funciones, testimonios, métricas inventadas ni publicación.

## Diseño

Revisión aprobada por el owner: desarrollar una página propia sobre el origen para
comercios de barrio, registro de actividad, reglas flexibles, previsión antes de
activar, conocimiento del cliente y una cuenta común con programas y datos
separados por negocio. Retirar el recorrido y la preparación repetidos de la
landing. Previsión compara consumo requerido con precio de venta de la recompensa;
no presentarla como margen neto ni cálculo por costos. Productos habituales se
explican en Mostrador, donde existen actualmente. Ejemplos claramente ilustrativos,
sin sustituir capturas reales pendientes por supuestas pantallas del producto.

Reutilizar BrandMark, estilos de negocios.css y lenguaje visual de la landing. Solo Iconoir. Contenido claro con hero, explicación, pasos, beneficios, FAQ y CTA. Tuteo. Sin fetch ni datos de clientes. Usar onboardingUrl y siteUrl. Canonical propio; no duplicar el contenido de otras páginas. Una persona implementa esta spec; integración y revisión separadas por root.

## Revisión UX aprobada

Aplicar hero explícito de puntos/sellos, transición breve, reglas en dos columnas
con ejemplos visuales y cashback secundario; previsión con cifras protagonistas;
historial/Mostrador en dos columnas; cuenta común con diagrama de dos programas y
saldos separados. Títulos concretos y copy reducido. CSS propio de esta ruta.
Sin material demo verificable disponible, usar esquemas explícitamente ilustrativos,
no capturas ficticias. Mantener retiradas las dos frases eliminadas por el owner.

## Archivos

Crear apps/public/src/app/programa-de-fidelizacion/page.tsx. El integrador cambia enlaces y sitemap; no tocar archivos compartidos desde agentes.

## Definition of Done

- [x] Ruta devuelve 200 y contenido principal en HTML con H1 único, canonical y CTA.
- [x] Typecheck public y lint de los archivos nuevos en 0.
- [x] Revisión responsiva de 390 y 1440 px con evidencia; no marcar hecha sin ejecutarla.
- [x] QA local del owner pendiente explícita; sin merge ni push.

## Mutaciones

Presupuesto 0: página informativa reversible. Verificar rutas y contenido, sin pruebas que reflejen implementación.

## Declarado afuera

Capturas reales del producto serán integradas después de obtener material de demo verificable. No sustituirlas por datos reales de clientes.

## Handoff

Implementador: agente asignado. Revisor: root. Registrar evidencia y límites antes de marcar implementada.

## Abierto

Ninguna decisión bloquea la primera versión local.

## Evidencia ejecutada

Root revisó código, HTTP 200, H1 único, canonical, enlaces internos sin destino inexistente, ausencia de errores de página y de overflow a 390 y 1440 px con Chromium. Se inspeccionaron las dos capturas /tmp/product-programa-de-fidelizacion-{390,1440}.png. Typecheck public y lint en 0 con Node 24. Precios no modificados, cashback Próximamente. QA owner aún pendiente.

## Evidencia de revisión de contenido (2026-10-10)

Recorrido y copy aprobados por el owner y aplicados. Typecheck public y eslint de
página pasan con Node 24; Prettier aplicado, diff --check en 0. Revisión nueva en
Chromium intentada fuera del sandbox: navegación a localhost:3003 agotó 30 s.
QA visual de esta revisión pendiente; la evidencia 390/1440 anterior corresponde
a la primera versión. No se corrieron suite ni verify global, ni merge/push.

## Evidencia de revisión UX aplicada (2026-10-10)

Propuestas del agente aprobadas y aplicadas en page.tsx y programa.css. Sin material
demo verificable, diagramas explícitamente ilustrativos. Typecheck public, lint de
página, formato y diff --check pasan. Localhost3003 agotó espera: QA realizada en
copia temporal de app con Next webpack3013. HTTP200, H1 único, canonical, anclas,
no overflow/errores a 390/1440 claro y oscuro. Capturas claras móvil/escritorio y
móvil oscuro inspeccionadas. QA owner3003 pendiente, sin suite/verify ni publicación.

## Ajuste hero autorizado

Owner pide eliminar nota de ejemplo del hero y mejorar tamaño/espaciado o elegir
foto/cuadrícula según evidencia UX. Se elige cuadrícula informativa: entrada QR
protagonista y dos bloques de acumulación/recompensa. Encabezado con más separación
y títulos/íconos mayores. Sin nota inferior, sin datos ficticios de personas ni foto.
Referencia: NN/G Using Imagery in Visual Design, priorizar información y procesos.

Evidencia ajuste hero: typecheck public/lint/diff0; capturas hero390/1440 vistas
con copia temporal3013 (HTTP200, anclas y canonical, sin overflow/pageerror).
Localhost3003 sigue timeout; no se afirma QA de ese servidor. Sin publicación.

Ajuste autorizado: simplificar gráfico de reglas retirando subtítulos y acumulación
por dólar duplicados. Mostrar solo 3/6 sellos con recompensa y 30 puntos→café.

Ajuste de atención autorizado: reemplazar diagrama de compras repetidas por vista
simplificada de Mostrador. Sigue el bloque real Habituales de este cliente arriba,
resaltado sobre catálogo; no afirmar que ya existe en creación de orden POS.
Representación identificada como ilustración, sin datos de clientes reales.

Owner descarta vista simplificada y aprueba probar escena: pase QR→café/empanada,
«Sus favoritos, a mano» y frase corta. Ilustración nativa HTML/CSS e Iconoir,
sin captura falsa ni cambios de funcionalidad. Sustituye propuesta Mostrador visual.

## Consistencia visual autorizada

Comparar página con landing en390/1440 claro/oscuro mediante estilos calculados y
capturas. Alinear títulos principales heredando escala65/41, radios de paneles12,
interlineado de tarjetas1.7 y fondos oscuros mediante mezcla ya usada en landing.
Conservar pase ampliado aprobado y jerarquías de ilustraciones/cálculo/transición.
Retirar selectores de contenido eliminado. No modificar landing ni kit merchant.

Evidencia consistencia: estilos calculados en ambas rutas390/1440 claro/oscuro,
4pares sin diferencias tokens/h1/h2principales/body/CTA/link/kicker/header. HTTP200,
sin overflow/pageerror. Capturas programa desktop claro/móvil oscuro y landing
 desktop claro vistas. Typecheck public/lint/diff0; QAowner pendiente, sin publicación.
