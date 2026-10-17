# 0237 — Entrega B HTTP/UI de ciclo de avisos

## Preparación test-only

Task `analytics-lifecycle-ui`, base `65b5152e`; worktree propio
`/private/tmp/checkpass-analytics-perf/analytics-lifecycle-ui`. Coordinador autorizó
preparar fixtures y oráculos antes del checkpoint A1. No incluye implementación de
UI, HTTP, servicios ni migración en esta primera pieza.

- Nuevos oráculos HTTP: autenticación, tenant/actor del guard, estructura/instantes,
  errores de dominio, cierre legacy sin efectos y cron autenticado.
- Fixture y browser lifecycle: categorías/capacidades, navegación sin cierre,
  versión obsoleta, recordatorio en zona del comercio con navegador en otra zona,
  límite de vigencia, refresco por fecha/foco y autoridad del ranking servidor.
- Adaptación aprobada de fixtures y pruebas anteriores: accept/dismiss ya no son
  decisiones de producto; usar Ignorar y enlaces sin POST. La tarjeta 11 está
  parqueada y no se expone; la navegación de campaña conserva cobertura. No se
  quitaron comprobaciones de histórico de AN-1, AN-2 o AN-3, ni se agregaron skips.

Validación de esta pieza: Node 24.20.0, formato focal y `git diff --check` sin errores.
No se ejecutaron suites contra el producto anterior: sus nuevos contratos aún no
existen. **No hay PASS funcional, de tipos, HTTP, browser o DB en esta entrega de
preparación.** Espera integración preservadora A1+B y GO de UI; servicios/rutas
siguen esperando A2. El harness es de componentes con HTTP simulado, no smoke de
una aplicación Next real.
