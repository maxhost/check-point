---
spec: 0018
fecha: 2026-08-10
estado: cerrada
resumen: Refactoriza los mockups merchant en componentes UI reutilizables, estados accesibles y fixtures separados de las páginas.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0018 — Fundación UI production-grade de merchant demo

## Alcance

Extraer y migrar componentes reales usados por los mockups: botones, icon buttons,
header de módulo, toast, diálogo de confirmación, tarjetas/estados y persistencia demo.
Eliminar duplicación, `window.confirm`, CSS duplicado y código muerto. Mantener las
rutas/UX existentes, sin introducir backend ni paquete compartido vacío.

## Definition of Done

- [x] Toast y confirmación reutilizables, accesibles y sin lógica duplicada por página.
- [x] Headers de módulo y X consistentes.
- [x] Sin `window.confirm` ni resumen muerto de onboarding.
- [x] Fixtures/persistencia demo aislados de render cuando haya uso compartido.
- [x] CSS consolidado, responsive y sin reglas duplicadas observables.
- [ ] Pruebas, build y PASS independiente.

## Abierto

Consumer conserva componentes propios hasta que exista contrato visual compartido
demostrado. Falta PASS de revisor independiente. Los gates locales `format:check`,
`lint`, `typecheck`, `test` (4/4) y `build` (3/3) pasaron el 2026-08-10. El E2E pasó
localmente el 2026-08-10: Playwright 3/3 en dos ejecuciones consecutivas. El sandbox no
puede iniciar esos servidores por restricciones de puertos.
