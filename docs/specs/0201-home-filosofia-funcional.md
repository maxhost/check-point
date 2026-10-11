---
spec: 0201
fecha: 2026-10-11
estado: cerrada
resumen: Aplicar la filosofía Funcional a la home debajo del hero aprobado.
disjunta: no
archivos: apps/public/src/app/consumer-home.tsx, apps/public/src/app/consumer-home.css, apps/public/DESIGN.md, apps/public/PRODUCT.md, apps/public/.impeccable/design.json, tests/e2e/landing.spec.ts
---

# 0201 — Home Funcional con hero preservado

## Problema

- `consumer-home.css:240` y siguientes: pasos con círculos e iconos grandes, wallet con icono de150px, sin demostración útil del pase. El owner pide acercar el cuerpo a la landing Funcional aprobada.
- `consumer-home.css:340` y siguientes: secciones con padding90px y ancho1398px; negocios usa ritmo65px y1190px. El CTA comercial ocupa una banda completa y compite con el recorrido consumidor.

## Alcance

UI pública bajo el hero: cómo funciona, wallet, programas ilustrativos, CTA comercial, FAQ y footer. Conservar orden, copy, enlaces y avisos de ejemplos. Hero, header, metadata, imagen, notificaciones y variables heredadas intactos. Sin publicación, otros productos, backend ni cambios en negocios. Reserva local dev ADR0128; revisión inline acotada ADR0129.

## Diseño

Adoptar Funcional con calidez de DESIGN.md. Wrapper exclusivo consumer-content con tokens claros/oscuros independientes para no cambiar el hero. Ancho1190px, laterales24/12px, separación65/45px, títulos37/29px, texto17px. Pasos numerados compactos y separados por líneas, sin iconos circulares gigantes. Wallet con demostración HTML del pase de café identificada como ejemplo, programa de6 sellos ya descrito, sin inventar saldo ni participantes. Descubrimiento con ejemplo contenido: nombre, recompensa y seis sellos sin progreso personal ficticio. CTA comercial verde contenido. FAQ nativas accesibles y footer alineado. Sin sombras decorativas ni imágenes nuevas. El diseño aprobado de negocios se reutiliza como lenguaje, no como contenido comercial.

## Archivos

Los seis archivos del frontmatter y esta spec/INDEX; estado GPT al cerrar. No disjunta de0197: adapta exclusivamente su cuerpo.

## Definition of Done

- [ ] Typecheck público, ESLint específico, formato y git diff --check salida0.
- [ ] E2E landing9/9 o mayor: textos, links, FAQ, secciones y ausencia de overflow390/1440 claro/oscuro.
- [ ] Build público salida0.
- [ ] Capturas reales1440/390 claro/oscuro y320/768 claro vistas; hashes de captura del hero iguales antes/después en cada viewport. FAQ por teclado. Cuerpo sin overflow; cualquier defecto existente del hero se declara.
- [ ] Guía y PRODUCT registran adopción parcial de home y excepción del hero; sidecar actualizado tras guía.

## Mutaciones

Presupuesto0: composición estática, sin nuevos flujos, cambios en cobro o aislamiento.

## Declarado afuera

Investigación con usuarios y validación de conversión. Defectos preexistentes del hero, que el owner excluye explícitamente. Auditoría inline del propio diseño, no revisión independiente.

## Handoff

Implementador y revisión inline según ADR0129, sin subagentes. Preview local disponible para owner; sin push/deploy.

## Abierto

Ninguna decisión de producto pendiente. El owner solicita este alcance y la filosofía aprobada.
