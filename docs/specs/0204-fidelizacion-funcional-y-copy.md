---
spec: 0204
fecha: 2026-10-11
estado: cerrada
resumen: Fidelización Funcional con copy claro de recompensas, previsión e historial.
disjunta: no
archivos: apps/public/src/app/programa-de-fidelizacion/page.tsx, apps/public/src/app/programa-de-fidelizacion/programa.css, apps/public/DESIGN.md, apps/public/PRODUCT.md, apps/public/.impeccable/design.json, tests/e2e/landing.spec.ts
---

# 0204 — Fidelización Funcional y copy preciso

## Problema

- page.tsx:313 cálculo «quedan $27» puede confundirse con ganancia; la previsión compara consumo y precio de venta del premio, no costos. FAQ actual reconoce esta limitación.
- programa.css y negocios.css heredados: hero de bloques coloreados, QR inclinado decorativo, encabezados enormes y bandas extensas. Captura real1440:5255px;390:7655px, sin overflow.
- page.tsx:140/390: beneficio de volver e historial aparecen subordinados a títulos abstractos y párrafos extensos. El dueño pide mismo enfoque que marketing: estructura, visual y copy.

## Alcance

Página /programa-de-fidelizacion completa con filosofía Funcional aprobada, texto mejorado, funciones y condiciones preservadas. Sin cambios en otras páginas, backend, kit merchant ni publicación. Un dominio UI estático, sin migraciones ni decisión abierta. Reserva local dev ADR0128; revisión inline ADR0129.

## Diseño

- CSS exclusivo program-page, retirar importación vieja; tokens claros/oscuros de DESIGN, Arial aprobada, ancho1190px, jerarquía59/41 y37/29, ritmo65/45, paneles delimitados sin sombras.
- Hero «Puntos o sellos. Motivos para volver.» Beneficio y registro manual del equipo explícitos; secuencia QR→compra acreditada→canje confirmado. No repetir campañas/red de marketing.
- Transición breve: compras, acumulación y canjes registrados conectados con cada cliente.
- Reglas: sellos por compra o por importe; puntos por importe. Mantener ejemplos aprobados3/6 sellos→café y30 puntos→café, sin recuperar subtítulos ni fórmulas por dólar retirados antes. Cashback secundario, Próximamente, previsto Impulso.
- Previsión: conservar$30 consumo/$3 precio de venta del premio; retirar «quedan $27». Comparación ilustrativa, no ganancia calculada. Aclaración completa en FAQ, sin inventar simulador interactivo.
- Historial: identificar con pase, consultar compras/puntos/canjes; productos habituales en Mostrador, no prometerlos en pedidos POS. Pase plano y diagrama identificación→consulta útil; sin falsa captura real ni datos privados.
- Cuenta común: mismos login/pase, programas y registros separados. Mantener Ana/cafetería4 sellos/gimnasio120 puntos como representación ilustrativa; sin tarjetas anidadas ni prometer saldo común.
- FAQ nativas7, enlaces reales de registro/planes/POS, prueba3 meses y metadata/canonical preservadas. Footer compartido consumido sin modificar.

## Archivos

Los seis archivos del frontmatter, esta spec/INDEX y estado GPT al cerrar. No disjunta de0191: sustituye presentación manteniendo reglas y decisiones de producto.

## Definition of Done

- [ ] Typecheck público, ESLint específico, formato y diffcheck salida0.
- [ ] E2E landing con casos fidelización: reglas, previsión sin ganancia ficticia, independencia de saldos/datos, cashback pendiente, FAQ, CTA y SEO; home/negocios/marketing conservados.
- [ ] Build público salida0.
- [ ] Capturas1440/390 claro/oscuro y320/768 claro vistas: sin overflow ni errores JS, anclas válidas, teclado. Fuente/tamaño y cierre aislados de globals.
- [ ] DESIGN/PRODUCT y sidecar registran adopción. Informe inline con hallazgos corregidos, evidencia y límites.

## Mutaciones

Presupuesto0: página informativa reversible, sin nuevos flujos ni dinero real.

## Declarado afuera

Validación de comprensión/conversión con comerciantes y disponibilidad de producción; sin revisión independiente.

## Handoff

Implementación y revisión inline ADR0129. QA owner del ensamblado local pendiente, sin push/merge/deploy.

## Abierto

Ninguna decisión de producto pendiente para el alcance solicitado.
