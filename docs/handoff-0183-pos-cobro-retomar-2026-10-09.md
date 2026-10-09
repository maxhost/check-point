# Retomar POS: escanear pase y confirmar cobro (0183)

Owner pide clear después de cerrar spec. **No iniciar implementación en esta sesión.**
Próximo turno: leer este checkpoint/spec y **armar plan de implementación primero**.
Spec: [0183](specs/0183-pos-escanear-pase-y-confirmar-cobro.md), estado cerrada, L3.
Checkout: ~/Documents/claude-workspace/check-point, rama local dev. Sin merge/push.
Último código visual guardado: **31d21b7**, botones Cobrar · QR · impresora en fila,
48 px; QR/impresora SIN acción. Cobrar todavía usa checkout anterior.

## Decisiones ya cerradas: no volver a preguntar

QR abre scanner, identifica cliente/valida cupón por API POS y vuelve a Pedido.
Contexto cliente/beneficio SOLO en memoria de esa orden seleccionada. Salir o
recargar lo pierde; tabs, guardar misma orden y Cancelar modal lo conservan.
Cobrar abre modal con importe, Recibido/cambio, regla y acreditación prevista;
Cancelar solo cierra. Confirmar cobro es único cierre/consumo/acreditación/asociación.
Sin cliente se puede cobrar. Impresora nueva queda fuera, se conectará aparte.
No nuevos medios de pago, API, quote, DB, persistencia, mesas ni cambios Mostrador.

## Evidencia y límites del API

POST /api/pos/resolve devuelve ResolveResponse con program.kind/accrual y cupón.
GET /api/pos/coupon-state revalida. POST /api/pos/orders/:id/close recibe UUID,
version, membershipId opcional y coupon opcional; transacción y rollback existentes.
**Resolver ya puede crear membresía saldo0/proyección y actualizar last_scan_at.**
No prometer cero escrituras al escanear: lo aplazado es venta/canje/acreditación y
asociación persistida de orden. Hallazgo comunicado al owner al cerrar la spec.
No llamar coupon-remove para excluir beneficio local; cambia elección del cliente.
Preview monetario en centavos respeta primera línea coincidente y snapshots,
reglas de coupon-discount.ts; no usar productCart agregado para decidir descuento.
Acreditación base previewUnits; extras separados. No quote garantizado: servidor
manda al cerrar. Timeout/5xx conservan mismo UUID/cuerpo y bloquean cancelación/
edición hasta resolver; jamás repetir con payload nuevo o sin beneficio en silencio.

## Código y contexto de la sesión

- 25ed581: detalle compacto, Editar/Pedido fullWidth, acciones MoreVert, X en título,
  footers separados, tabs Pedido sticky, toast al añadir. df0b45f estado anterior.
- bf026cf: cabecera mesa badge editable, selector de local en listado y modal mesa;
  contexto fijo de local, Cancelar no aplica borrador, texto sobrante retirado.
- Kit ya modificado: Dialog.headerAction, SegmentedControl.fullWidth y token overlay.
  **No ampliar kit por cuenta propia en 0183**: pedir pieza faltante a Claude.
- Estado actual con UI owner afinada; no inventar nuevo rediseño por iniciativa.
- Spec0182 de Claude ya implementa servidor mesas/tableId; UI fuera de esta spec.
  Preservar DTOs existentes; no mezclar esa feature al integrar cobro.

## Qué hacer al volver

1. nvm use; confirmar dev/git status y leer docs/TRABAJO-EN-PARALELO.md, estado GPT.
2. Leer 0183 completa, contratos/tipos y fuentes enlazadas. No inferir desde resumen.
3. Presentar plan de implementación con ownership de estado, límites de componentes,
   secuencia, baseline y pruebas concretas. Owner pidió ese plan **tras clear**.
4. Implementar después según 0183/plan; L3: implementador y revisor independientes
   (AGENT-WORKFLOW). Esta sesión no crea agentes ni ejecuta implementación/test suites.
5. Verificación real y QA scanner/cupón/modal/cancelación/cierre con DB local aislada.
   Nunca DATABASE_URL de PROD. No marcar implementada sin PASS independiente/gates.
6. Solo dev. No merge/publicación sin nueva instrucción; no push para reservar spec.

## Estado de archivos y verificación

Cambios ajenos que se preservan sin agregar/restaurar:
.claude/skills/gotchas-del-repo/SKILL.md y docs/LECCIONES.md.
Spec/INDEX/checkpoint/estado se guardan en commits locales. Números y diff-check
verificados en docs; no pruebas/compilación nuevas de producto ejecutadas hoy.
Los ajustes visuales recientes no tienen PASS automático global: no afirmarlo.
No depender de puertos/procesos/tmp tras clear; comprobar ambiente antes de suites.
