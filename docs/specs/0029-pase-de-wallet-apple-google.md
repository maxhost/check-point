---
spec: 0029
fecha: 2026-08-14
estado: borrador
resumen: Emisión del pase de fidelidad en Apple Wallet / Google Wallet (render del QR personal + botones "Añadir a Wallet") y el canal de push del pase; segunda rebanada del camino A.
disjunta: no
archivos: por definir (depende de 0028 y de un ADR de proveedor de Wallet)
---

# 0029 — Pase de Wallet (Apple / Google)

> **Stub — reserva de alcance.** No cerrada. Segunda rebanada del camino A (ADR 0031).
> Depende de la spec **0028** (identidad + QR personal ya emitido) y de un **ADR de proveedor
> de Wallet** aún no escrito.

## Problema

La spec 0028 emite el token de QR personal del consumidor pero no lo renderiza ni lo hace
portable. El modelo merchant-first (ADR 0031) define la **Wallet nativa como superficie del
consumidor**: la tarjeta y el canal de notificaciones viven en Apple/Google Wallet. Falta
generar y firmar el pase, ofrecer "Añadir a Apple/Google Wallet" según el dispositivo, y
abrir el canal de push del pase.

## Alcance (tentativo)

**Entra:** render visual del QR personal; emisión y firma del pase (Apple PassKit / Google
Wallet API); botones "Añadir a Wallet" en la landing de enrolamiento (0028); reflejo del
diseño de tarjeta del programa (reusa `CardPreview` / diseño de la spec 0027) en el pase;
apertura del canal de push del pase (consumido por la spec 0031).

**No entra:** el otorgamiento de puntos/sellos (spec 0030); el contenido de las
notificaciones (spec 0031).

## Dependencias

- **Spec 0028** — cuenta + `qr_token` + membresía.
- **ADR de proveedor de Wallet (por escribir)** — Apple PassKit + Google Wallet API:
  certificados, credenciales, firma, renovación del pase, secretos de entorno. Es una
  decisión de infra transversal; se decide antes de cerrar esta spec.
- **Spec 0027** — diseño de tarjeta, para que el pase refleje el branding del programa.

## Abierto (bloquea el cierre)

- Proveedor/infra de Wallet (ADR dedicado): certificados Apple, cuenta Google Wallet,
  manejo de secretos, estrategia de firma y actualización del pase.
- Un solo pase por consumidor con varias membresías, o un pase por membresía.
- Cómo se autoriza la generación del pase (sesión de consumer de 0028).
