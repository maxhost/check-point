---
fecha: 2026-08-10
resumen: La operación de merchant staff se diseña para resolver una asignación o canje en segundos, sin sacrificar consistencia.
estado: propuesta
---

# ADR 0016 — Operación de merchant staff rápida y consistente

## Propuesta

La app de operación será una ruta PWA específica, no el dashboard. Con sesión ya iniciada, el flujo habitual es: abrir escáner → leer QR de cuenta/cupón → ver contexto mínimo → ejecutar una acción preconfigurada → recibir confirmación.

La interfaz precarga campañas, catálogo y acciones permitidas para el local. No pide que staff escriba datos del consumidor ni navegue por formularios. El objetivo de producto es completar un canje o asignación común en un escaneo y hasta dos toques, con confirmación visible en menos de dos segundos en conectividad normal.

## Consistencia

La interfaz puede responder visualmente rápido, pero nunca confirma una entrega, saldo o canje hasta que el servidor complete una operación idempotente. V1 funciona en línea: si no puede confirmar con servidor, muestra estado pendiente/error y no entrega el beneficio dos veces.

## Consecuencias

- El dashboard y la operación se desarrollan como superficies distintas.
- La latencia, escáner y flujo de confirmación forman parte del DoD de las specs 0005 y 0006.
- Una conexión deficiente no se oculta con una confirmación optimista que pueda causar fraude.

