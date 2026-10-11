---
spec: 0201
fecha: 2026-10-11
estado: implementada
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

- [x] Typecheck público, ESLint específico, formato y git diff --check salida0.
- [x] E2E landing9/9 o mayor: textos, links, FAQ, secciones y ausencia de overflow390/1440 claro/oscuro.
- [x] Build público salida0.
- [x] Capturas reales1440/390 claro/oscuro y320/768 claro vistas; hashes de captura del hero iguales antes/después en cada viewport. FAQ por teclado. Cuerpo sin overflow; cualquier defecto existente del hero se declara.
- [x] Guía y PRODUCT registran adopción parcial de home y excepción del hero; sidecar actualizado tras guía.

## Mutaciones

Presupuesto0: composición estática, sin nuevos flujos, cambios en cobro o aislamiento.

## Declarado afuera

Investigación con usuarios y validación de conversión. Defectos preexistentes del hero, que el owner excluye explícitamente. Auditoría inline del propio diseño, no revisión independiente.

## Handoff

Implementador y revisión inline según ADR0129, sin subagentes. Preview local disponible para owner; sin push/deploy.

## Abierto

Ninguna decisión de producto pendiente. El owner solicita este alcance y la filosofía aprobada.

## Auditoría y verificación local — 2026-10-11

Revisión inline del propio trabajo (ADR0129); no estudio de usabilidad ni auditoría independiente. La evaluación visual precedió al detector. Se vio la home real antes y después, con1440/390 claro y oscuro,320/768 claro.

| Hallazgo inicial                                    | Resultado verificable                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Iconos grandes sustituyen información sobre el pase | Icono wallet sustituido por demostración HTML identificada como ejemplo; pasos numerados compactos. |
| Ritmo y ancho distintos de Funcional                | Contenedor1190px, separaciones65/45px, cuerpo17px y superficies de DESIGN.md.                       |
| Franja comercial compite con contenido consumidor   | CTA comercial contenido dentro del ancho común.                                                     |

Typecheck público, ESLint específico, Prettier y diffcheck salida0; números sin duplicados. Suite landing9/9 (9.9s), incluye nuevos oráculos de pase ilustrativo y programa6 sellos. Build público salida0. CI main verde4c40a6a; no implica publicación del trabajo local.

Evidencia: `/private/tmp/0201-e2e.log`, `/private/tmp/0201-build.log`, `/private/tmp/0201-before-review.json` y `/private/tmp/0201-after-review.json`.

Capturas del hero: SHA256 idéntico antes/después en los seis casos; header y hero conservados. Cuerpo sin overflow en los seis casos; sin errores JS; FAQ operable por teclado. A320px persiste el desborde de5px de la notificación del hero (scrollWidth325), ya presente antes y excluido por el owner. A390/768/1440 no hay desborde de página.

Desktop pasa de3009px a2892px de altura; móvil390 pasa de3642px a3978px al incorporar la demostración. No se presenta como reducción de scroll móvil ni mejora de conversión probada.

Detector: Arial es una elección confirmada de Funcional. Excepción persistida únicamente para consumer-home.css con ignore-value, sin ignorar archivos ni reglas completas. Quedan los avisos de escala tipográfica de variantes compactas/responsivas y estilos preexistentes del hero; no son fallos nuevos medidos. No se retoca el hero para resolver esas recomendaciones. DESIGN y sidecar registran explícitamente la adopción parcial.

Sin push, merge ni deploy. Negocios y otras páginas de producto conservadas.

Contraste calculado de texto:12.78:1 principal sobre blanco,5.99:1 secundario,5.60:1 secundario sobre panel; oscuro7.07:1 secundario sobre panel. El foco del CTA comercial se adapta a su fondo invertido:6.80:1 en claro y5.59:1 en oscuro. No constituye certificación completa de accesibilidad.
