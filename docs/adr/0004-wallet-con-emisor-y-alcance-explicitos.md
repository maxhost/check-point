---
fecha: 2026-08-09
resumen: El wallet reúne activos de Mi Pasaporte y comercios, pero cada uno conserva emisor, alcance y reglas de uso explícitas.
---

# ADR 0004 — Wallet con emisor y alcance explícitos

## Contexto

Mi Pasaporte debe sentirse como una cuenta general de descubrimiento, sin mezclar puntos o cupones de comercios diferentes. Los check-ins, sellos, coleccionables y retos son activos de la red; los puntos, cupones y créditos de juego son instrumentos de consumo del comercio.

## Decisión

El wallet es una única experiencia de usuario con dos secciones:

1. **Tu Pasaporte:** check-ins, sellos, coleccionables, retos y recompensas creados por el administrador de Mi Pasaporte.
2. **Beneficios de comercios:** puntos, cupones y créditos de juego emitidos por un comercio.

Todo activo almacena su emisor (`platform` o `merchant`) y alcance. Los beneficios de comercio llevan siempre el comercio/local de uso; no se suman ni se transfieren. Solo el administrador de plataforma crea sellos, coleccionables y retos de la red. Un check-in es un evento de Pasaporte, no una compra.

## Consecuencias

- La interfaz no muestra un saldo total global de puntos.
- Una oportunidad de juego no se modela como cupón: ambos se muestran como beneficios, pero tienen reglas de uso distintas.
- El empleado puede operar solo beneficios emitidos por su comercio; nunca sellos o retos de plataforma.
- Una ruta futura puede tener progreso propio de Pasaporte sin afectar los programas comerciales.
