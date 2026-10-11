---
spec: 0203
fecha: 2026-10-11
estado: implementada
resumen: Marketing para comercios con diseño Funcional y copy centrado en atraer clientes y promover su regreso.
disjunta: no
archivos: apps/public/src/app/marketing-para-comercios/page.tsx, apps/public/src/app/marketing-para-comercios/marketing.css, apps/public/DESIGN.md, apps/public/PRODUCT.md, apps/public/.impeccable/design.json, tests/e2e/landing.spec.ts
---

# 0203 — Marketing Funcional y mensajes claros

## Problema

- page.tsx:140 hero y campañas repiten «elige un beneficio» y «cuando se cumplen sus condiciones», sin jerarquizar nuevos clientes frente a regreso.
- marketing.css:14/136 y negocios.css heredado: invitación aislada con icono genérico, títulos enormes y espacios extensos. Captura real:3777px desktop1440 y5259px móvil390, sin overflow.
- page.tsx:185 y siguientes: público, condición y entrega repartidos entre textos y diagramas. Las campañas avanzadas se describen en un párrafo genérico.

## Alcance

Rediseño y copy de /marketing-para-comercios autorizado por owner, usando la filosofía aprobada de negocios. Un dominio público, estático, sin migraciones ni decisiones abiertas. Preservar funciones, prueba3 meses, planes, condiciones, enlaces, metadata/canonical y FAQ. Sin publicación, cambios en home/negocios/otras páginas ni backend. Reserva local dev ADR0128; revisión inline ADR0129.

## Diseño

- Estilos exclusivos marketing-page, sin importación de negocios.css; fondo claro/oscuro, ancho1190px, Arial aprobado, títulos59/41 hero y37/29 sección, ritmo65/45, paneles suaves, texto17, líneas finas, sin sombras decorativas.
- Hero «Invita a nuevos clientes. Dales motivos para volver.» Explicación concreta de campañas automáticas y control del beneficio. Demostración delimitada de Bienvenida: inscripción, beneficio, canje según condiciones, sin falsa captura de producto ni datos reales.
- Campañas en dos filas informativas: Bienvenida para inscritos, Venta cruzada para personas de otros comercios participantes. Diagramas cortos condición→beneficio; condición de rubros distintos y alcance2km visible. Ambos planes incluyen ambas campañas.
- Pasos compactos: programa/QR, beneficio y condiciones, activación/entrega automática. Sin mensajes individuales manuales ni promesa de visitas garantizadas.
- Impulso con dos situaciones explícitas (clientes que dejaron de venir, horarios tranquilos), beneficios elegidos por el negocio. Comparación de planes mediante enlace existente, sin tablas ni precios nuevos.
- FAQ más directas, preservando push condicionado a permiso/compatibilidad, sin WhatsApp ni email, independencia del POS, límites actuales sujetos a cambio. Cierre CTA y footer reales.
- Copy tutea, sin promesas de resultados, número de comercios, testimonios ni disponibilidad en producción. Fuentes locales: spec0192, PRODUCT y reglas de marketing/billing consultadas de solo lectura.

## Archivos

Los seis archivos del frontmatter, spec/INDEX y estado GPT al cerrar. No disjunta de0192: sustituye su presentación. Componentes compartidos solo se consumen, no se modifican.

## Definition of Done

- [x] Typecheck público, ESLint específico, formato y diffcheck salida0.
- [x] Suite landing específica verde, agregando comprobaciones de campañas, audiencia, condiciones, planes, FAQ y enlaces de marketing.
- [x] Build público salida0.
- [x] Capturas1440/390 claro/oscuro y320/768 claro vistas; sin overflow, errores JS ni destinos locales inexistentes; FAQ y navegación por teclado.
- [x] DESIGN/PRODUCT registran adopción y sidecar vigente. Auditoría inline con límites declarados y copy contrastado con fuentes locales.

## Mutaciones

Presupuesto0: landing estática reversible, sin nuevos flujos ni cambios en cobro/aislamiento.

## Declarado afuera

Estudio de comprensión/conversión con comerciantes y disponibilidad de producción. No afirmar revisión independiente.

## Handoff

Implementación y revisión inline ADR0129. Preview local para QA owner; sin push, merge ni deploy.

## Abierto

Ninguna decisión de producto pendiente para este alcance autorizado.

## Auditoría y evidencia local — 2026-10-11

Revisión visual y de copy inline según ADR0129. No revisión independiente ni prueba de comprensión con comerciantes. Se inspeccionó la página real antes de editar, luego los seis casos finales:1440/390 claro y oscuro,320/768 claro.

| Problema                                     | Cambio                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Mensaje comienza por la mecánica y la repite | Hero centrado en nuevos clientes/regreso; rol del comercio y automatización explícitos.                                                   |
| Campañas mezclan audiencia y condiciones     | Filas diferenciadas de Bienvenida y Venta cruzada, con audiencia, condición y diagrama juntos.                                            |
| Impulso genérico                             | Dos situaciones concretas: clientes que dejaron de venir y horarios tranquilos.                                                           |
| Jerarquía anterior de titulares y cierre     | Arial, escala Funcional, paneles delimitados, pasos compactos y cierre contenido. Estilos globales antiguos aislados dentro de marketing. |

Fuentes para el copy: spec0192, PRODUCT, packages/domain/src/server/marketing/cross-sale.ts (oferta tras compra), cross-rules.ts (rubros distintos, radio2000m), plan-gate.ts (Bienvenida/Venta cruzada en base). Fuentes leídas, sin modificar backend. El alcance2km se expresa como alcance de la red; no se convierte en garantía de visita, selección universal de destinatarios ni llegada obligatoria de push. Oferta y canje son etapas distintas. Prueba, planes y límites preservados; sin promesas nuevas de resultados.

Node24: typecheck público, ESLint específico, formato y diffcheck salida0; números sin duplicados. E2E13/13 en12.7s: home y negocios conservadas, cuatro casos nuevos de marketing para audiencia, condiciones, push, planes, CTA y canonical. Oráculos de tipografía y cierre detectan la herencia global incorrecta encontrada en el primer pase. Build público salida0.

Evidencia: /private/tmp/0203-review.json,0203-after-_.png,0203-e2e.log y0203-build.log. Capturas iniciales en0202-before-_.png (el0202 fue reservado por Claude durante la revisión; nuestra spec es0203).

Seis secciones, sin overflow ni errores JS en los seis casos, anclas existentes, salto al contenido y FAQ por teclado. Enlaces de registro reales y comparador de planes conservados. Texto secundario blanco5.99:1; oscuro sobre panel7.07:1. Foco de cierre6.80:1 claro y5.59:1 oscuro, comprobado con colores renderizados. No certificación completa de accesibilidad.

Altura desktop1440:3777→3244px; móvil390:5259→4939px. Son medidas de composición, no evidencia de más ventas ni de mejor comprensión.

Arial permanece por elección confirmada de la filosofía Funcional; excepción ignore-value limitada a marketing.css. Detector final0 primarios; avisos de variantes compactas y responsive quedan como recomendaciones, sin ignorar archivos o reglas completas. DESIGN/PRODUCT y sidecar registran adopción de marketing; fidelización y POS todavía mantienen sus diseños anteriores.

Sin push, merge ni deploy; QA owner del ensamblado local pendiente.
