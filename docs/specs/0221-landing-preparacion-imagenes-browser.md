---
spec: 0221
fecha: 2026-10-13
estado: cerrada
resumen: Preparación de imágenes de landing con las variantes reales del navegador y fallos visibles.
disjunta: si
archivos: tests/e2e/landing.spec.ts
---

# 0221 — Preparación de imágenes de landing

## Problema

La corrida global de verify0219 falló en landing390light: hero naturalWidth0 después30s y escenas0 después60s en reintentos. El caso aislado en frío pasa: no se afirma causa única reproducida. En tests/e2e/landing.spec.ts:105–117 warmUp descarga todas las variantes del srcset por fetch sin Accept de Chromium, no consume el cuerpo ni valida status y oculta errores. Esto deja sin garantizar la preparación prometida.

## Alcance

Entra: preparación y diagnóstico de imágenes reales en e2e de landing. No entra: diseño, assets, optimizador, servidor, API, kit ni relajación de aserciones.

## Diseño

beforeAll recibe browser. warmUp conserva rutas y usa contextos Chromium de390/1440px, altura960 y reducedMotion reduce. Cada documento debe responder200 y tener heading/estilos/fuentes preparados. Recorre imágenes visibles desplazándolas al viewport, espera complete y naturalWidth positivo, y decode exitoso. Usa selección responsive y negociación HTTP reales, sin mocks ni cambiar src/loading. Cierra contextos en finally. Errores incluyen ruta/currentSrc y el estado de imagen; nunca se capturan para continuar. El presupuesto de preparación sigue240s y cada imagen60s. Aserciones de producto, mediciones y presupuestos de tests intactos.

## Archivos

| Archivo | Acción |
|---|---|
| tests/e2e/landing.spec.ts | Sustituir precarga fetch de srcsets por preparación Chromium y diagnóstico |

Disjunta: sí, respecto0220 backend/POS y0219 equipo.

## Definition of Done

- [ ] 17e2e landing en servidor aislado, sin reintentos; capturas390/1440 vistas.
- [ ] Preparación rechaza una imagen rota: mutaciónM1 roja por carga de imagen y restaurada.
- [ ] ESLint/Prettier/diffcheck verdes.
- [ ] pnpm verify ejecutado una vez al final; tabla y limitaciones reales registradas.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutación | Oráculo |
|---|---|---|
| M1 | En copia temporal interceptar la imagen hero y devolver404 | beforeAll falla identificando imagen rota; no verde por omitir errores |

Bitácora previa, SHA limpio, medir y restaurar bytes; no mutar checkout compartido.

## Declarado AFUERA

No se prueba carga en teléfono real ni se afirma una causa única del fallo anterior solo por pasar aislado.

## Handoff

GPT implementa; PASS independiente pendiente. Sin push ni merge.

## Abierto

Ninguna decisión de producto abierta.
