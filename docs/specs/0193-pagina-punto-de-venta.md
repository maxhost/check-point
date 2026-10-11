---
spec: 0193
fecha: 2026-10-10
estado: implementada
resumen: Página pública de punto de venta para explicar el producto y permitir QA local.
disjunta: si
archivos: apps/public/src/app/punto-de-venta/page.tsx
---

# 0193 — Punto de venta

## Problema

La landing en apps/public/src/app/page.tsx muestra un acceso Descubre sin href porque la página específica no existe. El owner autoriza crearla para explicar el producto y mejorar SEO/GEO.

## Alcance

Entra: una página estática pública en /punto-de-venta, metadatos propios, CTA al registro existente y enlace a inicio. Catálogo IA desde foto/PDF, mesas opcionales, pedidos, cobro y programa integrado; impresión con dispositivos compatibles.
No entra: API, DB, billing, nuevas funciones, testimonios, métricas inventadas ni publicación.

## Diseño

Reutilizar BrandMark, estilos de negocios.css y lenguaje visual de la landing. Solo Iconoir. Contenido claro con hero, explicación, pasos, beneficios, FAQ y CTA. Tuteo. Sin fetch ni datos de clientes. Usar onboardingUrl y siteUrl. Canonical propio; no duplicar el contenido de otras páginas. Una persona implementa esta spec; integración y revisión separadas por root.

## Archivos

Crear apps/public/src/app/punto-de-venta/page.tsx. El integrador cambia enlaces y sitemap; no tocar archivos compartidos desde agentes.

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

Root revisó código, HTTP 200, H1 único, canonical, enlaces internos sin destino inexistente, ausencia de errores de página y de overflow a 390 y 1440 px con Chromium. Se inspeccionaron las dos capturas /tmp/product-punto-de-venta-{390,1440}.png. Typecheck public y lint en 0 con Node 24. Precios no modificados, cashback Próximamente. QA owner aún pendiente.
