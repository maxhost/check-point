---
spec: 0188
fecha: 2026-10-10
estado: implementada
resumen: Landing del comercio centrada en red, campañas y POS, con propuesta de planes para QA local.
disjunta: si
archivos: apps/public/src/app/page.tsx, apps/public/src/app/negocios/preview.tsx, apps/public/src/app/negocios/campaign-section.tsx, apps/public/src/app/negocios/closing-sections.tsx, apps/public/src/app/negocios/negocios.css, tests/e2e/landing.spec.ts
---

# 0188 — Landing de la red de comercios

## Problema

- `apps/public/src/app/page.tsx:127` presenta solo visitas recurrentes, sin explicar venta cruzada ni POS.
- `apps/public/src/app/negocios/closing-sections.tsx:92` ofrece Gratis y Plus, mientras el owner pidió prueba de tres meses y dos planes pagos.
- `apps/public/src/app/negocios/preview.tsx:40` ilustra sellos, sin mostrar red ni operación por mesa.

## Alcance

**Entra:** copy, secciones y previews de la landing pública en dev, conservando el lenguaje visual; modos claro/oscuro y QA 390 px/escritorio. Nivel L2, sin subagentes según ADR 0129.

**No entra:** API, billing, planes efectivos, merchant, herramientas, migraciones, merge ni push. La publicación queda bloqueada por billing según el encargo del owner.

## Diseño

Landing estática, sin consultas ni mutaciones. Orden: hero → red → campañas → POS/mostrador → tres pasos → cliente → planes → FAQ → CTA. Hero aprobado en ajuste de copy por el owner: «Atrae nuevos clientes y dales motivos para volver.», con eyebrow «PARA COMERCIOS LOCALES». Bajada: premiar compras, conectar con comercios cercanos y organizar pedidos/cobros desde el celular. Se conserva CTA y se indica «Empezamos en Cuenca» bajo el botón. Ajuste L0 de texto dentro del alcance cerrado; sin cambios de producto. La red enlaza `/explorar`; las fichas reales se descubren desde allí. Previews explícitamente ilustrativos, sin métricas ni clientes reales.

Nombres recomendados Conecta/Impulso (alternativas Club/Club Pro, Esencial/Crece). Propuesta visual: $20 USD/mes con 1 local, $45 con hasta 3, adicional $12; precios referenciales sujetos al owner. Ambos incluyen fidelización, wallet, mostrador, catálogo, clientes y Bienvenida/Venta cruzada; Impulso suma todas las campañas existentes. Prueba gratis de tres meses con todo incluido, sin afirmar ausencia de tarjeta. POS se explica fuera de columnas: su asignación a planes no se decide aquí. Los puntos/sellos son independientes por comercio. No prometer funciones futuras.

Conservar eyebrow/kicker, títulos con em, tarjetas, plan-grid, final-cta y fotografías; extender CSS local a la landing para ilustraciones y esquema oscuro del sistema. CTA consume onboardingUrl existente; `/negocios` sigue redirigiendo a `/`. Navegación por anclas y FAQ nativos accesibles; sin cuentas ni acceso a base de datos en pruebas.

## Archivos

| Archivo | Acción |
| --- | --- |
| `apps/public/src/app/page.tsx` | copy, orden de secciones y SEO |
| `apps/public/src/app/negocios/preview.tsx` | ilustraciones de red y POS |
| `apps/public/src/app/negocios/campaign-section.tsx` | tarjetas de campañas |
| `apps/public/src/app/negocios/closing-sections.tsx` | propuesta de planes, FAQ, CTA |
| `apps/public/src/app/negocios/negocios.css` | extensiones responsivas y oscuro |
| `tests/e2e/landing.spec.ts` | QA pública sin DB en cuatro combinaciones |

Disjunta de 0187 y de cambios de Claude en API/billing. Reserva local por instrucción explícita de no push.

## Definition of Done

- [x] Typecheck public y lint de public/prueba en salida 0 con Node 24.
- [x] Formato de archivos cambiados y git diff --check en 0.
- [x] E2E landing: 390/1440 px × claro/oscuro, sin overflow horizontal, planes y CTA correctos, FAQ y enlace a red; `/negocios` redirige.
- [x] Capturas inspeccionadas en las cuatro combinaciones, incluyendo planes y POS.
- [x] Handoff GPT con evidencia y dependencias de publicación, precios finales y POS.

Pruebas específicas de L2; verify completo reservado al pase a live (ADR 0128/0129). Sin presupuesto adversarial: contenido estático reversible, sin acceso a dinero ni datos. No se modifica lógica de alta o suscripción.

## Abierto

Fuera del alcance local: Claude debe implementar prueba de tres meses y Venta cruzada en plan base antes de publicar, salvo excepción explícita del owner. Owner confirma precio superior, adicional y plan de POS. Esto no bloquea la propuesta local solicitada.

## Evidencia ejecutada — 2026-10-10

Implementación L2 en `84df923`, reserva previa `b101434`. Typecheck public, lint public/prueba, formato y diff en salida 0 con Node 24. E2E final con servidor autónomo: **4 passed (5.1 s)**, salida 0 (`/tmp/0188-landing-autonomous.log`). Matriz 390/1440 × claro/oscuro; capturas de hero, red, POS y planes inspeccionadas. CTA, propuestas de planes, preguntas desplegables, anclas y redirect `/negocios` comprobados sin DB.

La inspección visual descubrió dos columnas en móvil y recorte oculto por overflow. Antes del fix, el nuevo oráculo falló: ancho 183.921875, esperado mayor que 292.5 (`/tmp/0188-mobile-regression-red.log`). Después: una columna con separación fija, previews completos y las cuatro pruebas verdes. Contraste secundario oscuro corregido. No se afirma CI remoto verde ni publicación.

La reparación prioritaria del CI existente está en `4f37e70`: capturas POS/mesas de `/private/tmp` a `/tmp`, 116/116 E2E verdes localmente. No modifica lógica ni afloja oráculos. La ejecución remota queda para un push posterior autorizado.

## Ajuste aprobado de la franja — 2026-10-10

Franja con tres beneficios, iconos lineales de personas, regalo y reloj, título y
una línea breve. Copy aprobado: «Atrae nuevos clientes / Llega a personas que viven
y compran cerca de tu negocio»; «Motívalos a volver / Premia sus compras para que
vuelvan a elegirte»; «Ahorra tiempo al atender / Organiza pedidos y cobros desde tu
celular y dedica más tiempo a tus clientes». En escritorio tres columnas; en móvil
se muestran los tres en una columna. QA visual del owner en localhost, sin tests
para estos ajustes de contenido por instrucción explícita del owner.

## Ajuste aprobado de iconos — 2026-10-10

Owner pide Iconoir en toda la landing. Consumir iconoir-react 7.11.0 (misma versión
que merchant) como dependencia directa de public; sin modificar kit ni paquetes
compartidos. Sustituir SVG manuales y símbolos usados como iconos: flechas, checks,
plus de FAQ y círculos del pase. Mantener marca, números ilustrativos y copy.
Archivos adicionales necesarios: apps/public/package.json y pnpm-lock.yaml.
Revisión visual en localhost por owner; sin E2E nuevos para ajustes de presentación.

## Título de la red aprobado — 2026-10-10

Owner elige «¿Cuántas personas compran cerca de ti y todavía no conocen tu negocio?».
Ajuste L0 del título; sin estadísticas inventadas. La página explicativa propuesta
queda pendiente de implementación; este ajuste no cambia el enlace existente.

## Historia visual de la red aprobada — 2026-10-10

Sustituir gráfico genérico por tres momentos ilustrativos: María compra en una
peluquería, recibe un café de bienvenida de una cafetería cercana y tiene un
motivo para visitarla. Regalo como foco, iconos Iconoir y flechas entre momentos.
Eliminar distancias/rubros/localidad del gráfico y conservar nota «Ejemplo
ilustrativo. Tú eliges qué ofrecer». Owner revisa en localhost; sin E2E.

## Diagrama de grupos convergentes aprobado — 2026-10-10

Owner aporta boceto: grupos de personas → gimnasio/peluquería/veterinaria →
un café de bienvenida → tu local/nuevos clientes. Sustituye la historia individual.
Tres fuentes siempre visibles, con líneas de convergencia y regalo central, iconos
Iconoir. Presentar oportunidad de nuevos clientes, sin métricas ni garantía de
visitas; conservar nota ilustrativa. Revisión visual local por owner, sin E2E.

## Reordenamiento de contenido aprobado — 2026-10-10

Owner pide ajuste L0 sin tests: sección nueva del programa de recompensas después
del hero/franja y antes de la red (QR → puntos/sellos → premio). Integrar explicación
de marketing automatizado y avisos al teléfono en la sección de red, conservando
pregunta y gráfico. Retirar CampaignSection de la landing y sus seis tarjetas.
Texto para futura página explicativa del programa pasa a la nueva sección.
No cambiar API ni alta. Actualizar mecánicamente aserciones de contenido existentes,
sin correr E2E; QA en localhost a cargo del owner.

## Secuencia visual de fidelización aprobada — 2026-10-10

Owner pide probar tres escenas conectadas en lugar de pasos textuales: se une
con QR → avanza con sellos → disfruta recompensa. Mismo pase ilustrativo en las
tres, progresión 0/3/6 sellos, QR como icono Iconoir, regalo al final y flechas.
Tres columnas en escritorio, secuencia vertical móvil. Sin QR real ni API. QA
local por owner, sin tests; actualizaciones mecánicas a la aserción del título.

## Simplificación visual aprobada — 2026-10-10

Owner descarta los tres pases repetidos por sobrecarga. Sustituirlos por escenas
claramente distintas: celular/QR, tres sellos de progreso y café de recompensa.
Sin tarjetas anidadas ni textos pequeños; títulos y una frase por escena. Mantener
Iconoir y flechas, secuencia horizontal escritorio/vertical móvil. Sin tests por
instrucción vigente; owner revisa en localhost.

## Ilustración del punto de venta aprobada — 2026-10-10

Owner aprueba sustituir preview de cobro aislado por teléfono central con orden y
cliente, acompañado de catálogo desde foto/PDF con IA, mesas y recompensa. Iconoir,
contenido ilustrativo estático, sin QR real ni interacción. Quitar textos de ejemplo,
precios unitarios y encabezado genérico. Adaptar composición a móvil, sin tests;
QA visual del owner en localhost.

## Cuadrícula de punto de venta aprobada — 2026-10-10

Owner descarta composición alrededor de teléfono y aprueba cinco bloques de tamaños
diferentes: Pedidos/cobros protagonista, Catálogo IA, Mesas, Fidelización y Tickets.
Un visual y título corto por bloque, poco texto, Iconoir y paleta existente. Móvil:
protagonista a ancho completo y cuatro bloques en dos columnas. Solo ilustración;
sin tests por instrucción del owner, QA en localhost.

## Cierre práctico aprobado — 2026-10-10

Owner convierte Cómo funciona en cierre práctico: «EMPIEZA CON TU NEGOCIO»,
«Prepara tu negocio e invita a tu primer cliente», tres pasos (recompensa, local,
primer cliente) y CTA al registro «Pruébalo gratis 3 meses», con nota de todo incluido.
Mantener ancla como-funciona. Ajuste L0 aprobado, QA en localhost sin tests.

## Retiro de sección del cliente — 2026-10-10

A pedido del owner, se elimina la sección «FÁCIL DE QUERER, FÁCIL DE USAR»
y su ilustración del pase. Ajuste L0; revisión visual a cargo del owner en localhost.

Ajuste L0 aprobado (2026-10-10): el cierre práctico queda en este orden: 01 Prepara tu local, 02 Activa tu programa, 03 Invita a tu primer cliente. Aplicado sin tests; el owner revisa en localhost.

Ajuste L0 aprobado (2026-10-10): encabezado de planes cambiado a «MÁS POSIBILIDADES PARA TU NEGOCIO». Sin tests; revisión en localhost por el owner.

Ajuste L0 aprobado (2026-10-10): título de planes directo, banner de prueba con las tres herramientas y campañas explicadas por beneficio. POS mencionado como herramienta de la plataforma sin asignarlo a un plan: el encargo mantiene esa decisión abierta. Precios sin cambios. Sin tests; revisión del owner en localhost.

Decisión del owner (2026-10-10), aplicada a la comparación de planes: POS, catálogo con IA, mesas, pedidos, Bienvenida, Venta cruzada, push y ficha pública en ambos; puntos y sellos en Conecta; Impulso agrega cashback y todas las campañas avanzadas, sin enumerar campañas pendientes de definir. Locales y precios sin cambios. Push con nota de límites futuros por tipo de cuenta (hoy sin límites); precio referencial con doble asterisco para distinguirlo. Esta decisión reemplaza la restricción de copy sobre cashback del encargo original; no implementa cashback ni cambia contratos de API. Requiere coordinar esa funcionalidad con Claude antes de publicar la promesa. Ajuste L0, sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): FAQ con «Resuelve tus dudas antes de empezar», sin bajada redundante, nueve preguntas sobre prueba, fin de prueba, uso independiente del programa, app, premios, Venta cruzada, puntos/sellos, equipos y locales. Fin de prueba descrito conforme al ADR 0134 (bloqueo sin suscripción y conservación de datos). Selector de pregunta actualizado; sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): cierre final «PRUÉBALO EN TU NEGOCIO», título «Empieza hoy. Descubre lo que puedes lograr en tres meses», resumen de fidelización, contacto y ventas con prueba gratuita. CTA de registro conservado. Sin tests; revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): CTA de registro «Pruébalo gratis 3 meses» y nota «Todo incluido durante la prueba» añadidos en las secciones de marketing y POS usando SignupLink y start-actions existentes, como en el cierre práctico. Accesos informativos futuros conservados. Sin tests; revisión del owner en localhost.

Ajustes L0 aprobados tras revisión UX (2026-10-10): hero identifica fidelización, marketing y POS; programa explica QR → acumulación → canje; marketing distingue clientes propios y nuevos; planes resumen diferencias, simplifican POS y avisos al teléfono y explican campañas avanzadas; preparación del POS opcional en paso 1; anclas de configuración dicen Cómo empezar. Diseño, precios y mecanismo de cashback conservados. Selectores de copy actualizados; sin tests, conforme a instrucción del owner. Revisión en localhost pendiente.

## Integración SEO aprobada — 2026-10-10

Owner autoriza crear páginas con specs 0191–0193, conectar los tres accesos, sitemap con esas rutas, metadata título y descripción y WebSite para marca. Precios conservados por decisión expresa; cashback debe decir Próximamente en planes. No se agregan casos inventados. Imagen social y capturas reales quedan previstas en plan de continuación.
