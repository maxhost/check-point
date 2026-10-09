# Retomar trabajo POS después del reinicio

Owner pidió guardar contexto en disco antes de reiniciar su computadora.
Retomar UI de POS en este mismo checkout, rama local **dev**.
Último commit de UI al pausar: **9e827b9**. Todo el código propio está commiteado.
No cambiar a main, mergear ni pushear sin nueva instrucción explícita.

## Punto de continuación

Seguimos afinando **paso 2 — Tomar pedido**, en
https://dev-business.checkpass.club/backoffice/pos. No hay otro cambio pendiente
aprobado para implementar: esperar revisión visual del owner y su siguiente ajuste.
Último cambio retiró texto visible Paso 2 de 3 y Catálogo, sustituyó Volver a mesa
por flecha circular junto al título y unió categorías/lupa en una fila.
Título de etapa, mesa/local pequeños y X protegida. Progreso sigue sr-only.

## Estado del producto

- 0181, **dda9edf**: nueva orden en Mesa / Tomar pedido / Revisar; Guardar pedido
  final. Sin importes al tomar/revisar, cantidades, Quitar línea y Deshacer;
  búsqueda añade desde revisión. Mostrador comparte DetailedSale conservando defaults.
- **625daaf**: catálogo precarga en Mesa al conocer local (único/recordado/elegido),
  Tomar pedido espera catálogo listo; retry explícito local. Cache deduplica/reutiliza,
  sin polling, TTL, refrescos por paso ni autosave.
- **9e827b9**: cabecera compacta y catálogo sin título/fila extra. Flecha previa
  cambia etapa; X vuelve al listado con protección de borrador. Navbar oculta en wizard.
- **e5eea9f**: márgenes/ancho comunes del listado, nueva y abierta (24 px mobile,
  48 desde md). **6e47f95**: texto central Nueva orden igual a Mostrador original.
- Navbar listado: POS / Nueva orden central destacada / Mostrador (0179).
- API catálogo en dev ya excluye unitPrice null, conserva cero y ranking subconjunto.
  Sin captura de precios POS; no modificar servidor. Históricos mantienen snapshots.
- Órdenes abiertas, precuenta/cobro/cupones e impresión conservan comportamiento.

## Verificación y pendientes

Último ajuste: typecheck 6 paquetes (4,348 s), ESLint, Prettier, guardia UI
6 archivos sin aumentos y diff-check verdes. E2e adaptados; NO ejecutados para
esta iteración. Owner pidió no ejecutar más suites durante esta sesión: no afirmar
PASS completo ni iniciar suites/build/global verify por iniciativa al retomar.
QA visual/teclado de esta versión pendiente; owner probará con pnpm dev:local.
No marcar spec implementada por inferencia; gates normales antes de publicación.

## Inicio después del reinicio

Leer docs/TRABAJO-EN-PARALELO.md y docs/estado/gpt.md; confirmar dev y estado de git.
Usar Node de .nvmrc (source ~/.nvm/nvm.sh y nvm use). pnpm ci:status es informativo
(si fetch falla, registrar y seguir). Levantar pnpm dev:local para prueba del owner.
No depender de sesiones/puertos o capturas/configs en /private/tmp: pueden no sobrevivir.
La cache POS y borradores son de memoria del montaje, no persistencia de navegador.
Las órdenes guardadas sí permanecen en DB; no introducir persistencia/TTL/polling.

## Reglas que se mantienen

UI con kit reutilizable, Tailwind y tokens; kit/tokens/CSS guard/tooling/API/servidor
son de Claude. No nuevos nativos/eventos nativos/paleta/arbitrarios ni CSS.
Cerrar spec antes de código (actual 0181 para ajustes menores; nueva spec si cambia
alcance), reservar local, commitear solo paths propios con git commit -- paths.
Mostrador conserva defaults del componente compartido.

Al pausar hay cambios ajenos sin commit en:
.claude/skills/gotchas-del-repo/SKILL.md y docs/LECCIONES.md.
No agregarlos, restaurarlos ni commitearlos; no usar stash/reset global.
Staging GPT vacío al entregar. Ningún push o merge de esta iteración.

## Fuentes de contexto

- docs/specs/0181-wizard-mesa-toma-revision-pos.md
- docs/handoff-0181-wizard-pos-2026-10-08.md
- docs/design-explorations/2026-10-08-pos-wizard-toma-de-pedido.md
- docs/design-explorations/2026-10-08-pos-mobile-ux.md
- apps/merchant/src/app/backoffice/pos/pos-editor.tsx
- apps/merchant/src/app/backoffice/pos/pos-cart.tsx
- apps/merchant/src/app/backoffice/counter/sale-forms.tsx
- tests/e2e/pos.spec.ts y tests/e2e/support/pos-counter-harness.tsx
