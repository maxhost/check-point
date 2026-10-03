---
spec: 0145
fecha: 2026-10-03
estado: cerrada
resumen: Marketing pide fecha de fin para Venta cruzada y describe el cupón automático de la spec 0143.
disjunta: si
archivos: apps/merchant/src/app/backoffice/marketing/{cross-fields.tsx,template-draft.ts,template-confirmation.ts,cross-ui.test.ts,marketing-home.tsx,[id]/campaign-detail.tsx}, docs/INDEX.md
---

# 0145 — Venta cruzada por compra en Marketing

## Problema

- `cross-fields.tsx:115` muestra «Fin (opcional)» y `template-draft.ts:99` exime `cross` de exigirla. La spec 0143 cambió M1: sin `endsAt`, la API responde 400 con `fields.endsAt`.
- `cross-fields.tsx:47-50,80,95`, `template-confirmation.ts:33-34`, `campaign-detail.tsx:184-189,299` y `marketing-home.tsx:185` aún dicen que el cliente reclama el cupón, aunque la compra lo entrega automáticamente.

## Alcance

**Entra:** exigir una fecha de fin válida al revisar una cruzada; mostrarla como obligatoria; describir la entrega automática, la vigencia desde la entrega y el tope de cupones entregados en el editor, resumen y detalle de Marketing.

**No entra:** servidor, API, paquetes, migraciones, push, lotería ni rediseño de «Mis beneficios». El consumidor ya recibe `origin: "cross"` en la lista común; la UI no llama C1/C2.

## Diseño

La cruzada requiere `endsAt` aun si el borrador no tiene cupón, y mantiene la regla de fecha posterior al inicio. La conversión existente a ISO se conserva. El mensaje de validación coincide con `fields.endsAt` del servidor: «Una campaña con cupón necesita fecha de fin.» La bienvenida y otras campañas conservan sus reglas.

Los textos explican que, tras una compra en otro comercio participante, la lotería puede entregar un cupón; el cliente lo ve en «Mis beneficios» y recibe el aviso de regalo por push si tiene el canal. No se promete un cupón por cada compra. La vigencia corre desde la entrega automática; el tope mensual cuenta cupones entregados. Al finalizar la campaña, los cupones ya entregados conservan su vencimiento.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/marketing/cross-fields.tsx` | editar campos y textos |
| `apps/merchant/src/app/backoffice/marketing/template-draft.ts` | exigir `endsAt` de `cross` |
| `apps/merchant/src/app/backoffice/marketing/template-confirmation.ts` | actualizar resumen |
| `apps/merchant/src/app/backoffice/marketing/cross-ui.test.ts` | probar requisito y textos |
| `apps/merchant/src/app/backoffice/marketing/marketing-home.tsx` | actualizar confirmación de cierre |
| `apps/merchant/src/app/backoffice/marketing/[id]/campaign-detail.tsx` | actualizar detalle y cierre |
| `docs/INDEX.md` | reservar número |

**Disjunta?** Sí. La 0143 y la 0144 están implementadas y no modificaron estos archivos de UI.

## Definition of Done

- [x] `cross-ui.test.ts` comprueba que sin `endsAt` hay error, con fecha válida no lo hay y M1 recibe la fecha ISO (4/4 verdes; M1 roja y restaurada).
- [x] Los textos visibles de Marketing no describen reclamo manual de la Venta cruzada (`rg` de los textos viejos: solo queda la bienvenida y una aserción negativa del test).
- [x] `rg -n 'cross-offers|/claim' 'apps/consumer/src/app/(consumer)/wallet'` no encuentra llamadas a C1/C2.
- [ ] `pnpm verify` en verde con Node 24 y e2e de UI; tabla en el handoff.

## Mutaciones — presupuesto: 1

Quitar la nueva validación de `endsAt` en `template-draft.ts` debe poner rojo el test que exige fecha. Se registra la salida antes de restaurar el código.

## Handoff

GPT implementa y verifica; un revisor independiente da PASS antes de marcar `implementada`.

## Abierto

Nada.
