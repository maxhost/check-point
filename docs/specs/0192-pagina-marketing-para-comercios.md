---
spec: 0192
fecha: 2026-10-10
estado: implementada
resumen: Página pública de marketing para comercios para explicar el producto y permitir QA local.
disjunta: si
archivos: apps/public/src/app/marketing-para-comercios/page.tsx, apps/public/src/app/marketing-para-comercios/marketing.css
---

# 0192 — Marketing para comercios

## Problema

La landing en apps/public/src/app/page.tsx muestra un acceso Descubre sin href porque la página específica no existe. El owner autoriza crearla para explicar el producto y mejorar SEO/GEO.

## Alcance

Entra: una página estática pública en /marketing-para-comercios, metadatos propios, CTA al registro existente y enlace a inicio. Bienvenida, Venta cruzada y beneficios de campañas avanzadas existentes; clientes propios frente a nuevos; avisos al teléfono, sin WhatsApp/email.
No entra: API, DB, billing, nuevas funciones, testimonios, métricas inventadas ni publicación.

## Diseño

Reutilizar BrandMark, estilos de negocios.css y lenguaje visual de la landing. Solo Iconoir. Contenido claro con hero, explicación, pasos, beneficios, FAQ y CTA. Tuteo. Sin fetch ni datos de clientes. Usar onboardingUrl y siteUrl. Canonical propio; no duplicar el contenido de otras páginas. Una persona implementa esta spec; integración y revisión separadas por root.

## Revisión UX aprobada

Owner autoriza aplicar auditoría independiente: sustituir NetworkPreview del hero
por invitación compacta, mostrar condición→beneficio en cada campaña, eliminar
párrafos repetidos y formato de planes. Eyebrow y títulos precisos. Tres pasos,
Impulso compacto, FAQ y cierre conservados. CSS scoped marketing, sin alterar
landing/componente NetworkPreview compartido. Invitación ilustrativa, no captura
falsa del producto ni visita garantizada. Verificar tamaño y lectura390/1440.

## Archivos

Crear apps/public/src/app/marketing-para-comercios/page.tsx. El integrador cambia enlaces y sitemap; no tocar archivos compartidos desde agentes.

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

Root revisó código, HTTP 200, H1 único, canonical, enlaces internos sin destino inexistente, ausencia de errores de página y de overflow a 390 y 1440 px con Chromium. Se inspeccionaron las dos capturas /tmp/product-marketing-para-comercios-{390,1440}.png. Typecheck public y lint en 0 con Node 24. Precios no modificados, cashback Próximamente. QA owner aún pendiente.

## Evidencia de rediseño UX

Typecheck public/lint/formato/diff0. Revisor independienteChromium3003: HTTP200,
H1/canonical/anclas válidos, sin overflow/pageerror390/1440claro/oscuro.
Invitación745→260pxdesktop y757→201mobile; hero móvil1427→848px.
Root vio hero1440claro/campañas390claro. QA owner pendiente; sin publicación.
