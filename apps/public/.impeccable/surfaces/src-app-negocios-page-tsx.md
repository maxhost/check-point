---
version: 1
slug: "src-app-negocios-page-tsx"
primary_target: "src/app/negocios/page.tsx"
related_targets: ["src/app/negocios/business-landing.css","src/app/negocios/preview.tsx"]
---

# Landing comercial para negocios

Modo Persuade. Ruta /negocios. Spec 0198. Owner prioriza nuevos clientes y ventas; publicación excluida. Comp aprobado: .impeccable/mocks/decision/negocios-proxima-visita-integrado.png. Confirmación: «quedo perfecto, avanzamos»; foto y plan: «aprobado».

## Direction contract

THESIS: Una invitación de bienvenida da al próximo cliente un motivo para entrar; la fidelización le da razones para volver.

OWN-WORLD: Identidad aprobada de la home: Arial, crema, verde profundo y terracota; oscuro según preferencia. Texto HTML sobre fotografía ilustrativa de una dueña entregando café. Marca y biblioteca Iconoir existentes.

STORY: Atraer con Venta cruzada → motivar el regreso con recompensas → atender con POS → preparar el local → elegir plan tras la prueba → resolver dudas y registrarse.

FIRST VIEWPORT: Distribución expresamente pedida por el owner: título, explicación y botones dentro del hero a la izquierda, escena a la derecha. Burbuja inclinada de bienvenida. El owner pide retirar las etiquetas «ejemplo» de toda la landing. Debajo: mapa del barrio con una invitación.

FORM: Seed c0e4f966, candidata de visita invitacional; mezcla aprobada con distribución de barrio conectado. Tipografía y geometría fluidas en escritorio; móvil refluye para preservar legibilidad y alcance táctil. Fotografía aprobada se sirve en public/images/negocios-bienvenida.png, idéntica a assets/plates/welcome-scene.png. Sin cifras, testimonios o comercios participantes inventados.

FINISH: Revisiones reales 1536,1440 y390 claro/oscuro, tipos/lint/build y E2E específico. L2 sin subagentes conforme ADR0129; revisión inline declarada. QA del owner del sitio ensamblado pendiente. Sin push, merge ni deploy.

## Ampliación elegida el 2026-10-11

El owner selecciona «El barrio conectado» para rediseñar todo el cuerpo. Referencia: .impeccable/mocks/completa/barrio-sin-etiquetas.png (variante de barrio.png con las retiradas de texto solicitadas). Mapa de comercios e invitación → QR y premio sobre mesa → escena de atención y paneles POS → inicio compacto → planes → FAQ → cierre verde. La selección no acepta el cuerpo antiguo de0198. Implementación y QA del cuerpo pendientes.

Copy: retirar toda mención visible de «ejemplo», sustituir «Café de ejemplo» por «Café» y eliminar avisos «Ejemplo ilustrativo», incluidos sus fondos. No extender el cambio a la home. Conservar condiciones comerciales y no añadir afirmaciones de participación real.
