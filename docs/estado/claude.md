# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-08, noche) — POS (spec 0169) IMPLEMENTADO EN `dev` CON PASS; UI DE GPT Y PROD PENDIENTES

**Hecho en `dev` (L3, sin push; `main` intacto):**
- `656eaa3` spec 0169 + ADR 0130 (decisiones del owner del 2026-10-08 escritas en la spec, no volver a preguntar).
- `79e3efc` API del POS: migracion `0066` (`core.pos_order`, `core.pos_order_item`, `business.pos_enabled`, `pos` en el
  CHECK de permisos; aplicada en la base LOCAL y en la rama de CI, **NO en PROD**), rutas `/api/pos/*` y
  `PUT /api/merchant/business/pos`, `posEnabled` en la sesion, escalera comun `server/operator-guard.ts`.
- `53fec62` `/delete-user` borra las mesas del POS cobradas con el pase del cliente (owner; medido en la base local).
- `2e8a159` test `pos-close-reuse` (afterGrant y `request_reused`, oraculos del revisor; muerde: «expected 503 to be 409»).
- Verificado por Claude: POS 35/35 + 2/2, mostrador/permisos/sesion 142/142, typecheck ok. Revisor: PASS, `pnpm verify` ok
  salvo e2e (el ambiente local ocupa :3200).

**Pendiente:**
- Encargo a GPT: pantallas del POS contra §Contrato de la spec 0169 (interruptor + modal de ordenes abiertas, imprimir,
  calculadora de cambio, esconder el toggle `pos` en Equipo con el modulo apagado).
- Hallazgo a decidir (owner): cerrar con pase una mesa cuyo local se archivo despues acredita en el local archivado.
- Merge a `main` (pedido antes por el owner, sigue pendiente): bajar el ambiente local, `pnpm verify` completo con e2e,
  `merge --ff-only`, probar `main` en local, push SOLO con OK. La migracion 0066 va a PROD con ese paso y con OK.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo con acceso abierto y
puertos 3200/3201 (ADR 0127); no borra secretos de sus archivos de entorno: se COMENTAN; R2 de desarrollo; Vercel
Hobby; rotacion de claves la decide el owner. Wallet real en el telefono: decision ABIERTA. Telefono (PWA + push)
parqueado (#80). POS: todo lo de la spec 0169 §Decisiones; canje de premios solo en el mostrador; canje como cupon
desde la app = PARQUEADO #81.

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos; par VAPID de
desarrollo; el ejemplo de entorno sin el bloque de la 0167 ni `BETTER_AUTH_SECRET`/puertos nuevos (agentes sin permiso).
