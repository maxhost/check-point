---
spec: 0017
fecha: 2026-08-10
estado: superada por la spec 0065 (2026-09-16) — el tile «Campañas» ya NO apunta acá
resumen: Owner gestiona campañas demo con plantillas cerradas, calendario, locales, recompensas, resultados mock y transiciones de estado.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0017 — Campañas del owner demo

> **SUPERADA — 2026-09-16, fase B3 de la spec 0065.** El tile «Campañas» apunta a
> `/backoffice/marketing`, que es una pantalla real contra la base
> (`marketing-backoffice-pages.neon.integration.test.ts` lo asevera, y asevera que ya no linkea a
> `/backoffice/demo/campaigns`). **Las rutas `/backoffice/demo/campaigns*` siguen existiendo pero
> ya no son alcanzables desde el backoffice**; su compositor en frases con bloques cerrados fue la
> referencia visual que heredó el de la 0065.
>
> **Estado real 2026-09-09 — verificado contra el código.** **Este mock no fue superado: es el destino real del tile «Campañas»** (`backoffice/page.tsx:80` → `/backoffice/demo/campaigns`). Las campañas reales están **diferidas** (ADR 0034) y su rediseño vive en la spec 0003, dentro de la capa de marketing del ADR 0057.

## Alcance

Home de campañas, detalle con resultados mock y wizard de creación por objetivos de
negocio: tráfico, franja, fidelidad, reactivación y feedback genuino; objetivos que
requieren POS, duración o rutas aparecen bloqueados con su requisito. Captura
locales, vigencia y horarios recurrentes por día de semana, comportamiento verificable,
recompensa, límites y presupuesto fixture. Owner pausa activas, archiva pausadas y crea
borradores demo. No entra Incentive Engine, backend, economía real, publicación real ni
emisión de beneficios.

El paso de configuración no es un formulario genérico de premio: adapta su contenido al
objetivo. Tráfico define primera visita/check-in; fidelidad, la ventana de retorno y el
programa compatible; reactivación, el período sin visitas; franja, el beneficio del
calendario elegido; feedback, el destino de una solicitud neutral sin incentivo.

El wizard sigue siempre este orden: **1. Constructor**, **2. Fechas y horarios**,
**3. Revisión**. El objetivo se elige dentro de la primera frase del constructor y sólo
recomienda una configuración inicial: no bloquea el disparador, la condición ni la
distribución. El constructor presenta texto fijo y dropdowns o campos acotados para
objetivo, disparador, condiciones, distribución, beneficio y límite. No es texto libre ni
un formulario separado de premio: la regla se lee completa mientras se configura.

## Definition of Done

- [ ] Owner crea campaña demo desde una plantilla cerrada.
- [ ] Owner elige un objetivo disponible y ve su comportamiento verificable y métrica
  primaria antes de definir el beneficio; objetivos sin fuente de dato se explican como
  bloqueados.
- [ ] El objetivo limita los incentivos a opciones justificadas; Puntos/Sellos sólo se
  muestran para el programa activo compatible y el owner configura el efecto elegido.
- [ ] Configura inicio/fin, horarios recurrentes por día con una o más franjas, locales,
  recompensa y límites fixture. Las franjas no se solapan y se interpretan en la zona
  horaria del negocio.
- [ ] Ve campaña activa y resultados mock relevantes.
- [ ] Pausa activa y archiva una pausada.
- [ ] Responsive, toasts, pruebas/build y PASS independiente.

## Abierto

Contratos reales de Spec 0003 se implementan posteriormente.
