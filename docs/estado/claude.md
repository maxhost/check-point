# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-12) — NOTA DE ORDEN POS (API + 0073 EN PROD) Y COPY NEUTRO DE `my.`; NADA PUSHEADO DESDE `3fe2ad6`

**En PROD:** codigo `origin/main` = `3fe2ad6` (sin cambios). **Base:** migracion **0073** (`core.pos_order.note`, nullable +
check 1..1000) **aplicada en PROD** el 2026-10-12 por MCP (snapshot previo `snap-round-math-ax7g0rmi`; leido por SQL: 74 en
`drizzle.__drizzle_migrations`, hash = sha256 del `.sql`, 7 ordenes / 0 con nota) y en la base local (74). Aditiva: el codigo
de PROD no la lee; el codigo nuevo SI (`readPosOrder` selecciona `note`), asi que ya puede ir el push.

**Hecho esta sesion (en `dev`):**
- `075f6f0` nota libre en la orden del POS (L1 por decision explicita del owner, excepcion al piso L2): `note` en crear/editar
  (ausente conserva, null/espacios borra, >1000 → 422, cerrada/anulada → 409) y en `PosOrder.note`. `pos-orders` Neon 8/8
  (`tools/neon-test.sh`). Contrato en spec 0169 §«Nota de la orden». PARQUEADO #93 (cifrar la nota) y #94 (puntos por persona
  al dividir la cuenta; el owner eligio division SOLO de pantalla, de GPT). La UI de la nota la esta haciendo GPT (0209).
- `5c9d465` textos de `my.checkpass.club` en registro **neutro e impersonal** (owner: sin tu, vos ni usted): ~90 textos en 18
  pantallas + 6 mensajes de API; regla nueva `apps/consumer/COPY.md` (PRODUCT.md ya no dice «tutea»). Verificado: consumer
  104/104, `welcome-ui` 7/7, typecheck + lint verdes, `pnpm run test` 256 archivos verdes. **Sin correr:** `wallet-entry.spec.ts`
  (e2e actualizado, 4 titulos): no arranca con el `next dev` del owner en :3200; lo corre el pre-push.
- `ee692fd` estado con la 0073 en PROD; `main` local quedo en `ee692fd` (ff). Despues GPT siguio en `dev` (0209, UI de nota).
- `d980b93` investigacion **POS sin conexion** (solo docs, sin codigo): decisiones del owner en
  `docs/investigacion-pos-sin-conexion-2026-10-12.md`, **parqueada** como PARQUEADO #95 (owner: «guardalo y dejalo parqueado»).
  Sin confirmar: lectura del limite de 48 h (pasado el plazo se deja de vender offline hasta sincronizar).

**QUE SIGUE:**
1. Cuando GPT cierre la 0209: `main` ← `merge --ff-only dev`, probar `main` en local y push **con OK del owner** (pre-push
   corre `pnpm verify`, incluido `wallet-entry`). La 0073 ya esta en PROD: no hay orden que cuidar.
2. **A decidir por el owner:** pasar a neutro tambien el pase de Wallet y sus push (`packages/domain/src/server/wallet/push-text.ts`,
   `reminder.ts`: «Revisa tus beneficios», «Te quedan…», «Tienes un cupon nuevo»).
3. **A decidir por el owner:** ajuste de `.claude/hooks/verify.sh` propuesto (no aplicado): guardar la huella del ultimo ROJO y,
   si el arbol no cambio, avisar sin bloquear. Motivo: esta sesion el Stop hook bloqueo ~15 turnos seguidos por un rojo del
   trabajo sin commitear de GPT (texto de `welcome-offer.tsx`), sin que Claude hubiera tocado codigo.
4. Lo de antes sigue: QA del owner en iPhone (login por codigo, PWA del POS, «Imprimir tickets», vencimiento en el wizard);
   hallazgo: el alta con email existente sigue mandando LINK; ramas `spec-0190`, `motor`, `sin-gate-email` sin decidir.

**Decisiones del owner, no volver a preguntar:** nota por ORDEN (no por producto), editable hasta cerrar, datos personales en
texto plano «como una libreta»; dividir la cuenta = solo pantalla, un pase elegido por el grupo; copy del cliente neutro
impersonal (`apps/consumer/COPY.md`); ADR 0134–0137; 0206 apagada para todos; U5/U6 descartadas; POS quita el cupon solo de la
venta (0183); precio de la landing «dejalo asi».

| Descartado | Por que |
|---|---|
| Division de cuenta guardada en base con puntos por persona | Owner: no sabe si alguien lo quiere; parqueado #94 |
| Hook que mire solo archivos tocados por la sesion | En auto mode Claude edita por Bash; no queda registro confiable |
