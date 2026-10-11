---
spec: 0198
fecha: 2026-10-10
estado: cerrada
resumen: Landing /negocios centrada en nuevos clientes y motivos para volver, con hero aprobado y recorrido comercial renovado.
disjunta: no
archivos: apps/public/src/app/negocios/**, apps/public/public/images/negocios-bienvenida.png, apps/public/PRODUCT.md, tests/e2e/landing.spec.ts
---

# 0198 — Nuevos clientes y motivos para volver en /negocios

## Problema

- `apps/public/src/app/negocios/page.tsx`: hero con foto separada del mensaje; el owner pidió integrar título, explicación y CTA dentro de la escena aprobada.
- La sección del programa precede al marketing: el owner prioriza atraer clientes y vender más, después explicar cómo vuelven y cómo atenderlos.
- El owner aprobó diseño, mensaje y nueva distribución en `negocios-proxima-visita-integrado.png`: «quedo perfecto, avanzamos».

## Alcance

**Entra:** diseño y copy comercial de /negocios; hero, primer bloque, orden nuevos clientes→volver→POS→empezar→planes/FAQ/registro; responsive y oscuro; pruebas específicas. L2, un dominio, sin migraciones ni decisión abierta.

**No entra:** publicar, home para consumidores, cambios a las páginas de producto, APIs/servidor/kit, condiciones comerciales, precios, nuevas funcionalidades ni resultados garantizados.

## Diseño

Referencia: `apps/public/.impeccable/mocks/decision/negocios-proxima-visita-integrado.png`, aprobada en chat. Conservar Arial y paleta de la home. Textos y controles HTML accesibles; fotografía ilustrativa regenerada sin UI pintada.

- Header con marca a /, Cómo funciona a #como-funciona, Planes a #planes, Preguntas a #preguntas y registro existente mediante onboardingUrl. Accesos visibles en móvil.
- H1 exacto: «Dale a tu próximo cliente un motivo para entrar.» dentro del hero a izquierda, con énfasis terracota final. Bajada «Llega a personas que compran cerca. Invítalas a conocer tu negocio y dales razones para volver.»
- CTA «Pruébalo gratis 3 meses» y Cómo funciona a #como-funciona; nota Todo incluido durante la prueba. Escena de propietaria entregando café al cliente a derecha; burbuja HTML inclinada «Un café de bienvenida / Café de ejemplo»; «Ejemplo ilustrativo. No es una oferta vigente.» visible. No teléfono flotante.
- Primer bloque «La primera visita es solo el comienzo.»: invita nuevos clientes→premia su regreso, como la composición aprobada. La ilustración no acredita comercios participantes.
- Atraer (#red): explicar Venta cruzada como beneficio ofrecido a clientes de otros comercios, no recomendación activa del otro negocio. Mantener preview y enlace a marketing.
- Volver (#programa): QR para unirse; compras/acciones del programa para acumular; condiciones para canjear. Mantener preview y enlace a programa. Ninguna visita sola garantiza puntos/sellos.
- POS (#beneficios): operación del pedido/cobro y recompensas, preview existente y enlace a página específica.
- Empezar (#como-funciona), planes (#planes), FAQ (#preguntas) y cierre: registro/prueba; precios $20/$45 y condiciones actuales preservados. No cambiar cashback ni promesas de planes en este trabajo.
- Metadata y WebPage JSON-LD siguen canonical/OG /negocios, con mensaje comercial actualizado.
- Mobile reordena copy y escena para mantener legibilidad; dark conserva fotografía, controles y contraste. Sin overflow. Reduced motion y foco accesible.
- Plan/asset review de Impeccable antes de código, según su playbook; no aprobar en nombre del owner. QA del ensamblado posteriormente.

## Archivos

| Archivo | Acción |
| --- | --- |
| apps/public/src/app/negocios/page.tsx | hero, primer bloque, orden y copy; metadata |
| apps/public/src/app/negocios/business-landing.css | estilos acotados al nuevo wrapper |
| apps/public/src/app/negocios/preview.tsx | preview de bienvenida; módulos existentes preservados |
| apps/public/public/images/negocios-bienvenida.png | foto ilustrativa sin UI, con prompt/procedencia |
| tests/e2e/landing.spec.ts | oráculos comerciales nuevos y regresión home/enlaces |
| apps/public/PRODUCT.md | composición y enfoque implementados localmente |

No disjunta de0197/0188/0191–0193; preservar home y estilos/previews compartidos usados fuera de /negocios.

## Definition of Done

- [ ] Tipos y ESLint de public salida0 con Node24; Prettier y diffcheck salida0.
- [ ] Suite landing con configuración temporal sin webServer compartidos: home y /negocios a390/1440 claro/oscuro; enlaces, planes, FAQ y registro, sin overflow ni errores de página.
- [ ] En pruebas: H1 exacto; hero contiene CTA/nota de ejemplo; orden #red antes de #programa antes de #beneficios; escena cargada, fotos/controles accesibles.
- [ ] Build public salida0. Capturas del hero y secciones vistas por implementador.
- [ ] QA owner del sitio ensamblado, antes de publicar; no afirmar producción verificada.

Verificación L2 específica sin DB, Neon o adversarial (presupuesto0); verify global solo al paso live ADR0128/0129. Barrido previo confirmó símbolos, rutas, etiquetas de planes y número0198 disponible.

## Mutaciones — presupuesto: 0

Explicación comercial estática, sin flujo nuevo de dinero/login/aislamiento. No se cambia el registro ni el contrato HTTP.

## Declarado afuera

Producción, disponibilidad real de red activa, fotos de comercios participantes, testimonios o métricas, pruebas Stripe y efectos del marketing. Ilustraciones no acreditan resultados.

## Handoff

Un implementador, L2 sin subagentes conforme ADR0129. Mantener nueva clase wrapper para no afectar páginas compartidas.

## Abierto

Ninguna decisión de producto pendiente. Comp aprobado; plan/asset y QA del ensamblado pertenecen a su verificación, no son elecciones inventadas durante el código.
