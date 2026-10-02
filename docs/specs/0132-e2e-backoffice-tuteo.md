---
spec: 0132
fecha: 2026-10-02
estado: implementada
resumen: Reparar el harness de navegación y actualizar los e2e de backoffice al texto vigente en tuteo para dejar Playwright en verde.
disjunta: si
archivos: tests/e2e/**, docs/INDEX.md, docs/specs/0132-e2e-backoffice-tuteo.md
---

# 0132 — E2E de backoffice con navegación y copia vigentes

## Problema

- `tests/e2e/support/catalog-harness-server.ts:51` no exporta `usePathname`, importado por `apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx:12`. Los nueve casos de `brand-lifecycle` fallan al compilar con `No matching export in "fixture:navigation" for import "usePathname"` (reproducido en `main`, 2026-10-02).
- `tests/e2e/brand-lifecycle.spec.ts:16` y `tests/e2e/support/brand-tour-fixture.ts:26`, entre otros, buscan los textos antiguos «Dale identidad a tu negocio» y «¿Qué querés hacer?». La UI usa tuteo según `apps/merchant/COPY.md`.

## Alcance

**Entra:** exportar `usePathname` en el stub con una ruta coherente con el fixture; actualizar locators, acciones y expectativas de `tests/e2e/` según el texto visible actual; corregir defectos de harness o tests necesarios para dejar `pnpm test:e2e` verde.

**No entra:** cambiar la copia de producto para acomodar tests, ni los tests de servidor de la spec 0131. Un bug real de UI se documentará como hallazgo para el owner.

## Diseño

Mantener los tests ligados al contrato visible de cada pantalla. Para cada texto fallido, leer la UI que monta el fixture y verificar el nombre accesible real. El stub de `usePathname` devuelve una ruta de backoffice estable que no active el modo de mostrador fuera de su fixture.

## Archivos

| Archivo | Acción |
|---|---|
| `tests/e2e/support/catalog-harness-server.ts` | editar |
| `tests/e2e/**/*.ts` | editar solo donde el contrato de UI cambió |

**Disjunta:** sí respecto de 0131.

## Definition of Done

- [x] `pnpm test:e2e` pasa con Node 24 y Chromium instalado: 106 passed, 5 skipped.
- [x] Con Node 24 pasan `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` y `pnpm run format:check`.
- [ ] `pnpm run build`: Turbopack falla al abrir un puerto interno para procesar CSS en consumer (`EPERM`), incluso fuera del sandbox. El build de consumer con `--webpack` pasa; este problema queda fuera del alcance de la spec.
- [x] Los cambios de tests se corresponden con nombres o textos presentes en la UI actual; no se modifica copia de producto para aprobarlos.

## Mutaciones — presupuesto: 0

La reparación es de harness y expectativas obsoletas; el gate e2e completo es el oráculo. No se introduce lógica de producto nueva.

## Declarado afuera

- `marketing-valley` queda bajo el seguimiento existente #67.

## Handoff

Un implementador; revisión final de los gates y del diff antes de publicar.

## Abierto

Nada.
