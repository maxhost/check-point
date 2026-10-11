---
spec: 0199
fecha: 2026-10-11
estado: cerrada
resumen: Rediseño completo del cuerpo de /negocios según El barrio conectado, sin etiquetas de ejemplo.
disjunta: no
archivos: apps/public/src/app/negocios/**, apps/public/public/images/negocios-*, tests/e2e/landing.spec.ts
---

# 0199 — El barrio conectado en la landing de negocios

## Problema

- `apps/public/src/app/negocios/page.tsx` conserva NetworkPreview, LoyaltyJourney y DashboardPreview del cuerpo anterior. El owner rechazó que0198 se limitara principalmente al hero.
- `apps/public/src/app/negocios/preview.tsx` muestra Café de ejemplo y un aviso ilustrativo que el owner pide retirar.
- El owner elige la segunda propuesta completa y confirma «listo elegido» el 2026-10-11.

## Alcance

Entra: cuerpo completo de /negocios, retirada de etiquetas, nuevos recursos de mapa, recompensa y atención, comparación compacta, FAQ, cierre, responsive y oscuro. Nivel L2; un dominio sin migraciones.

Fuera: publicación, home, páginas de producto, API, kit, precios o funcionalidades nuevas.

## Diseño

Contrato visual: `apps/public/.impeccable/mocks/completa/barrio-sin-etiquetas.png`. Arial, crema, verde profundo, terracota y hero aprobado se conservan.

1. Hero aprobado, burbuja Café, sin aviso ilustrativo.
2. #red: Tu próximo cliente compra cerca. Mapa del barrio, comercios genéricos y beneficio tras una compra. Tres beneficios: conocer tu local, condiciones propias, invitaciones automáticas. Enlace informativo a marketing conservado.
3. #programa: Dales razones para volver. Escena de mesa con QR y premio. Compras o acciones acumulan puntos/sellos; canje bajo condiciones. Texto y controles HTML; recursos fotográficos separados. Enlace al programa conservado.
4. #beneficios: Atiende, cobra y recompensa. Fondo verde, escena de atención con tablet y tres paneles HTML de pedido, identificación y recompensa. Precios demostrativos café $3, croissant $2, total $5. Sin controles de operación fingidamente clicables; enlace al producto.
5. #como-funciona: Empieza con tu primer cliente. Prepara tu local / completa datos; Activa tu programa / puntos o sellos y premio; Invita a tu primer cliente / comparte el QR.
6. #planes: Planes para hacer crecer tu negocio. Conecta $20 USD/mes**, un local, puntos/sellos, Bienvenida y Venta cruzada, POS/catálogo IA/mesas/pedidos; Impulso $45 USD/mes**, hasta tres locales, todo Conecta, campañas avanzadas y cashback próximamente. Conservar ficha pública, push y sus condiciones, local adicional $12 y precio referencial sin repetir largas listas. Aside independencia de saldos por negocio.
7. #preguntas: preguntas comerciales en dos columnas de details accesibles; conservar información sobre prueba, bloqueo/conservación de datos, app, premios, varios locales, equipos e independencia del POS. Retirar la palabra ejemplo de respuestas de esta variante únicamente. No afirmar acumulación automática por visita.
8. Cierre verde con Pruébalo gratis 3 meses, invitación y motivos para volver; onboardingUrl existente. Footer compacto con enlaces legales y navegación.

No referencias visibles a ejemplo en /negocios. No afirmar comercios participantes ni resultados reales. Las demostraciones no alteran precios o condiciones comerciales. Metadata canonical/OG /negocios preservada. Reflujo móvil, foco, reduced-motion, textos alternativos y contraste claros/oscuros.

## Archivos

| Archivo | Acción |
| --- | --- |
| apps/public/src/app/negocios/page.tsx | ensamblado completo |
| apps/public/src/app/negocios/business-landing.css | composición específica y responsive |
| apps/public/src/app/negocios/preview.tsx | limpiar hero; preservar exports usados por productos |
| apps/public/src/app/negocios/barrio-scenes.tsx | mapa, recompensa y atención |
| apps/public/src/app/negocios/closing-sections.tsx | variante comercial compacta; defaults compartidos preservados |
| apps/public/public/images/negocios-* | recursos definitivos con procedencia |
| tests/e2e/landing.spec.ts | actualizar oráculos al cuerpo nuevo y preservar regresión de home |

No disjunta de0198 y páginas0191–0193: estilos específicos y variantes opt-in evitan cambiarlas.

## Definition of Done

- [ ] Typecheck, ESLint y formato públicos con Node24 salida0; diffcheck0.
- [ ] Suite landing específica a390/1440 claro/oscuro: imágenes cargadas, navegación, FAQ, CTA, condiciones y ausencia de ejemplo en texto de /negocios; home conserva contrato anterior.
- [ ] Build public salida0 y capturas desktop/mobile vistas, sin overflow ni pageerrors.
- [ ] Comparación real con comp elegido y documentación de diferencias; QA owner del ensamblado pendiente hasta respuesta.

L2: sin subagentes, adversariales o verify global; este último al paso live ADR0128/0129. Reserva local previa al código. Barrido previo confirmó0199 libre y símbolos afectados. Plan y recursos definitivos se revisan conforme Impeccable antes de app code.

## Mutaciones

Presupuesto0: página comercial estática sin cambios en flujos de dinero/login/aislamiento.

## Declarado afuera

Prueba de efectos reales de campañas, disponibilidad de red activa y publicación.

## Handoff

Un implementador; revisión inline declarada, sin revisor independiente por ADR0129. QA de owner para resultado ensamblado.

## Abierto

Sin decisión de producto pendiente. Selección confirmada; revisión concreta de recursos y verificación pendientes.
