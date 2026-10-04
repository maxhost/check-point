---
spec: 0149
fecha: 2026-10-03
estado: cerrada
resumen: Pantallas de la PWA y el mostrador para elegir, validar, quitar y vender con el cupón de la 0148.
disjunta: no
archivos: apps/consumer/src/app/(consumer)/wallet/**, apps/consumer/src/app/wallet.css, apps/merchant/src/app/backoffice/counter/**, apps/merchant/src/app/globals.css
---

# 0149 — Pantallas del cupón elegido

## Problema

- `benefits-tab.tsx` aún abre el QR sin guardar la elección y no muestra el comercio de «acá».
- `counter-console.tsx` envía la venta sin cupón; `stages.tsx` no muestra `couponState` ni un ticket con total neto.
- `counter-home.tsx` interpreta las filas `entryKind: coupon` como «Puntos +0 coupon».

## Alcance

**Entra:** UI de P0–P2 y M0–M4 del contrato 0148, sondeo con la pantalla del cliente abierta, historial de cupones, limpieza mecánica de tipos, test y CSS huérfano.

**No entra:** cambios en API, servidor, paquetes o migraciones.

## Diseño

La PWA pide P0 con lat/lng juntos solo si ya tiene permiso de ubicación; muestra `here` arriba y agrupa los cupones por comercio. PUT P1 elige uno válido y DELETE P2 lo deja de usar. La selección se muestra en la lista y el detalle. Los errores `{error,code}` quedan visibles y la lista se refresca después de mutar.

El mostrador muestra el estado de M0 y sondea M1 cada cuatro segundos mientras `resolved` está abierto. `selected` de descuento va a la venta; otros tipos admiten M2. M2 abre éxito con «Continuar con el cliente» y «Escanear otro». M3 quita una elección o validación removible. M4 incluye `couponId` y, cuando el cupón de producto no tiene producto fijo en venta detallada, el `productId` elegido del carrito. El ticket usa `grossTotal`, `discountAmount` y `total` devueltos por el servidor. Los errores de M1–M4 son visibles; no se afirma un descuento que el servidor rechazó. Los movimientos `coupon` muestran su etiqueta y las unidades solo para extras.

Autorización y aislamiento quedan en las rutas existentes: la UI solo usa la sesión actual y la membresía resuelta. No persiste coordenadas.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/src/app/(consumer)/wallet/{benefits-tab,wallet-shell,page}.tsx`, `apps/consumer/src/app/wallet.css` | editar |
| `apps/merchant/src/app/backoffice/counter/{types,counter-console,stages,counter-home}.tsx` y componentes nuevos, `types.ts`, `types.test.ts` | editar |
| `apps/merchant/src/app/globals.css` | editar |

**Disjunta?** No; completa la UI de la spec 0148.

## Definition of Done

- [ ] Elegir y quitar un cupón dispara P1/P2; P0 presenta `here` y `selected`.
- [ ] Sondeo M1, validación M2, quitar M3 y grant M4 funcionan según contrato, con ticket neto e historial correcto.
- [ ] `stages.tsx` tiene como máximo 300 líneas y no queda CSS de cupón huérfano.
- [ ] `pnpm verify` verde con Node 24.

## Mutaciones — presupuesto: 0

La verificación de UI se hará con tests y gate; no se programan mutaciones en esta entrega.

## Declarado AFUERA

- QA en local físico con permisos GPS, cupón real y venta de producción.

## Handoff

Implementación de GPT; revisión independiente y QA del owner posteriores antes de marcar `implementada`.

## Abierto

Nada.
