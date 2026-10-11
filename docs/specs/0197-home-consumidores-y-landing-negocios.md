---
spec: 0197
fecha: 2026-10-10
estado: cerrada
resumen: Home explicativa para consumidores en / y landing comercial conservada en /negocios, con ejemplos identificados y navegación por audiencia.
disjunta: no
archivos: apps/public/PRODUCT.md, apps/public/src/app/page.tsx, apps/public/src/app/consumer-home.tsx, apps/public/src/app/consumer-home.css, apps/public/src/app/negocios/page.tsx, apps/public/src/app/negocios/closing-sections.tsx, apps/public/src/app/programa-de-fidelizacion/page.tsx, apps/public/src/app/marketing-para-comercios/page.tsx, apps/public/src/app/punto-de-venta/page.tsx, apps/public/src/app/explorar/page.tsx, apps/public/src/app/lugares/[slug]/page.tsx, apps/public/src/app/es/(legal)/layout.tsx, apps/public/src/app/layout.tsx, apps/public/src/app/sitemap.ts, apps/public/public/images/checkpass-consumer-visit.png, tests/e2e/landing.spec.ts
---

# 0197 — Home para consumidores y landing comercial en /negocios

## Problema

- `apps/public/src/app/page.tsx:147` presenta «Atrae nuevos clientes» a dueños de
  comercios. El owner confirmó que la home de CheckPass.club debe dirigirse a
  consumidores; en esta etapa debe explicar el producto, sin comercios reales que
  mostrar.
- `apps/public/src/app/negocios/page.tsx:4` redirige a `/`. La landing comercial debe
  tener una ruta propia accesible desde menú, buscadores, enlaces directos y CTA
  de la home.
- `apps/public/src/app/negocios/closing-sections.tsx:301` y páginas de producto
  apuntan a anclas comerciales de `/`; `sitemap.ts:6` no incluye `/negocios`.
  `lugares/[slug]/page.tsx:120` vuelve a `/#explorar`, aunque el directorio vive en
  `/explorar`.

## Alcance

**Entra:** UI pública L2: home explicativa en `/`, traslado de la landing comercial
actual a `/negocios`, enlaces por audiencia, SEO de ambas rutas, imagen ilustrativa
del hero y pruebas específicas. Un dominio, sin migraciones ni decisiones de
producto abiertas. Brief de Impeccable shape confirmado por el owner.

**No entra:** directorio real, datos de comercios, inscripción desde ejemplos,
login, Wallet, APIs, campañas, billing, cambios de precios o funciones, rediseño de
la landing comercial, tooling, kit merchant, merge a main ni publicación.

Se reserva en `dev` mediante commit local, conforme al ADR 0128. No se pushea `dev`.

## Diseño

### Home y composición aprobada

Modo de la home: Persuade. Objetivo: un consumidor entiende qué es CheckPass, cómo
participa en un programa y dónde consultar su pase, sin confundir ejemplos con
ofertas activas.

Concepto aprobado: **Una visita como ejemplo**. Referencia visual aprobada:
`apps/public/.impeccable/mocks/decision/ejemplo-visita.png`, con prompt y aprobación
en su sidecar. La escena de café, QR, pase y recompensa conduce la explicación.
Se conserva la identidad actual y el sistema claro/oscuro. La composición aprobada
es referencia de traducción responsive; textos, enlaces, controles y progreso se
implementan como HTML accesible, no dentro de un bitmap.

Orden de la home:

1. Header con marca a `/`, «Cómo funciona» a `/#como-funciona`, «Explorar ejemplos»
   a `/explorar`, «Para tu negocio» a `/negocios` y «Mi pase» a `consumerWalletUrl`.
2. Hero: «Descubre lugares. Encuentra motivos para volver.»; explicación del
   descubrimiento, programas y beneficios; CTA «Ver cómo funciona» a
   `#como-funciona`. Escena «Café de ejemplo», seis sellos para un café, identificada
   con «Ejemplo ilustrativo. No es una oferta vigente». El QR es un símbolo
   decorativo, sin token ni destino de inscripción.
3. `#como-funciona`: visitar un negocio participante y escanear su QR para unirse;
   acumular puntos o sellos según las reglas del comercio; canjear la recompensa.
   El QR permite unirse; acumular exige compras o acciones que el negocio defina.
4. Explicación del pase: navegador, Apple Wallet o Google Wallet; cada comercio
   tiene su programa y saldo propio. No hay puntos globales ni transferencia de
   sellos entre negocios.
5. Descubrimiento y beneficios: ejemplos de lo que puede ofrecer un negocio y
   enlace «Explorar ejemplos» a `/explorar`. Nota de que el directorio actual es
   demostrativo. Sin listado que parezca una red ya operativa ni promesas de
   disponibilidad inmediata.
6. Bloque breve para comercios: fidelización, campañas automáticas y POS; CTA
   «Conoce CheckPass para tu negocio» a `/negocios`.
7. FAQ: cómo unirse, qué representa la demostración, dónde consultar el pase y si
   los puntos sirven en otro negocio. Footer con accesos a ejemplos, pase,
   `/negocios`, privacidad y términos.

No se muestran testimonios, ratings, conteos de comercios, check-ins sociales ni
«Descargar la app». Los ejemplos no inscriben, no entregan beneficios y no piden
sesión, geolocalización ni notificaciones. La home no requiere una base de datos.

### Landing comercial y enlaces

`GET /negocios` responde 200 y conserva el contenido, orden, precios referenciales,
planes, FAQ e ilustraciones actuales de la landing. Solo cambian ubicación,
imports relativos, metadata y enlaces necesarios. El alta conserva `onboardingUrl`.

La marca del sitio apunta a `/` y su nombre accesible expresa inicio general.
Los enlaces a planes y FAQ comerciales desde otras páginas pasan a
`/negocios#planes` y `/negocios#preguntas`; los de Cómo empezar compartidos,
a `/negocios#como-funciona`. Las anclas internas de la landing siguen funcionando.
Todos los «Para negocios» y «Para tu negocio» de explorador, fichas y legales
apuntan a `/negocios`. Volver a explorar desde una ficha apunta a
`/explorar#explorar`. La navegación dentro de las páginas de producto se conserva.

### Metadata y estados

La home tiene título/description para consumidores, canonical `/`, Open Graph con
URL raíz y WebPage propio. La landing mantiene su título comercial, canonical
`/negocios`, Open Graph y WebPage con su nueva URL. WebSite y Organization siguen
identificando el sitio y la organización, sin afirmar participantes o cifras.
El sitemap incluye ambas URLs. `/explorar` y sus fichas conservan su política
actual de demostración/noindex. Robots y redirects compartidos no se modifican.

Estados: contenido estático disponible desde el render inicial; imagen sin cargar
no elimina explicación ni CTA; FAQ con details/summary accesible. En móvil, escena
legible en una columna y navegación por audiencia sin overflow. Teclado, foco
visible, jerarquía de headings y reduced-motion conservados. No hay respuestas de
API, estados de pago ni mutaciones que especificar en este cambio.

## Archivos

| Archivo | Acción |
| --- | --- |
| `apps/public/PRODUCT.md` | Actualizar rutas y etapa confirmada tras implementación |
| `apps/public/src/app/page.tsx` | Home y metadata de consumidores |
| `apps/public/src/app/consumer-home.tsx` | Componentes de la nueva home |
| `apps/public/src/app/consumer-home.css` | Composición aprobada, responsive y oscuro |
| `apps/public/src/app/negocios/page.tsx` | Landing actual trasladada; retirar redirect |
| `apps/public/src/app/negocios/closing-sections.tsx` | Anclas comerciales y nombre accesible de marca |
| Páginas `programa-de-fidelizacion`, `marketing-para-comercios`, `punto-de-venta` | Enlaces hacia planes de `/negocios` |
| `apps/public/src/app/explorar/page.tsx` | Accesos comerciales a `/negocios` |
| `apps/public/src/app/lugares/[slug]/page.tsx` | Accesos comerciales y vuelta al directorio |
| `apps/public/src/app/es/(legal)/layout.tsx` | Acceso comercial a `/negocios` |
| `apps/public/src/app/layout.tsx` | Metadata por defecto coherente con consumidores |
| `apps/public/src/app/sitemap.ts` | Incluir `/negocios` |
| `apps/public/public/images/checkpass-consumer-visit.png` | Imagen de escena, ilustrativa, con procedencia |
| `tests/e2e/landing.spec.ts` | Home y landing comercial en las mismas cuatro combinaciones |

**Disjunta:** no respecto a 0188 y 0191–0193: comparten la landing y enlaces. Sus
cambios existentes se preservan; las páginas explicativas solo reciben ajustes
de navegación. Sin colisión con servidor, kit, migraciones o tooling de Claude.

## Definition of Done

- [ ] `pnpm --filter @mi-pasaporte/public typecheck` y lint de los TS/TSX afectados
      en salida 0 con Node 24; formato y `git diff --check` en salida 0.
- [ ] `pnpm exec playwright test tests/e2e/landing.spec.ts`: home y landing en
      390/1440 × claro/oscuro, respuesta 200, H1 único, sin errores de página ni
      overflow. La suite existente conserva los oráculos comerciales en
      `/negocios` y sustituye su expectativa de redirect por respuesta 200.
- [ ] En esa suite, la home muestra nota de ejemplo, CTA a Cómo funciona, acceso
      al pase, navegación y CTA comerciales a `/negocios`; las fichas regresan al
      directorio y los enlaces de planes llegan a `#planes` de `/negocios`.
- [ ] En esa suite, canonical/OG diferenciados por audiencia y sitemap con ambas
      rutas. Capturas mediante `testInfo.outputPath`, vistas por el implementador.
- [ ] `pnpm --filter @mi-pasaporte/public build` en salida 0.
- [ ] QA local del owner sobre composición aprobada, acceso al pase y separación
      de audiencias antes de publicar. No afirmar producción verificada.

Pruebas específicas L2, sin DB ni suite Neon. Si los servidores compartidos
impiden la corrida específica, usar configuración temporal de Playwright sin
webServer y `PUBLIC_LANDING_TEST_URL` contra public local; registrar el comando
exacto. No modificar tooling para evitar un gate. `pnpm verify` completo se
ejecutará al pasar a live, conforme a ADR 0128/0129.

Barrido previo al cierre: `rg` confirmó las anclas y rutas citadas, disponibilidad
de 0197 y ausencia de etiquetas de mutación en `apps/public`. La coincidencia
`E2E_LOYALTY_MUTATION_TEST` en e2e es una variable de una suite existente, no una
mutación de este trabajo.

## Mutaciones — presupuesto: 0

Página explicativa estática y traslado de navegación; sin dinero, login,
aislamiento, escrituras ni datos reales. ADR 0129 permite pruebas específicas sin
adversariales cuando no aparece un riesgo que las justifique.

## Declarado AFUERA

- Feed de comercios reales, buscador productivo, mapa, check-in social y ofertas
  vigentes; los ejemplos siguen claramente identificados.
- Nuevas funciones del pase o del registro; esta UI solo enlaza los accesos
  existentes.
- Cambios a precios, disponibilidad de cashback o reglas de campañas.
- Resolver enlaces externos antiguos con fragmentos comerciales en `/`; se
  corrigen los enlaces internos identificados, sin tocar redirects de servidor.
- Reparar o publicar todo el backlog de CI como parte de esta spec.

## Handoff

Implementación L2 en la conversación principal, sin subagentes (ADR 0129).
Documentar comandos realmente ejecutados, capturas vistas, archivos afectados y
límites antes de marcar implementada. Reserva y documentación no acreditan la UI.

CI remoto comprobado al preparar la spec: `9405c93`, rojo en E2E POS por rutas de
capturas `/private/tmp`. La corrección local preexistente es `4f37e70`; no se
declara el remoto verde ni se altera esa prueba en esta spec.

## Abierto

Ninguna decisión de producto dentro del alcance. Home explicativa, ejemplos
identificados, `/negocios` y concepto visual confirmados por el owner. QA e
implementación pendientes; publicación requiere su aprobación según ADR 0128.
