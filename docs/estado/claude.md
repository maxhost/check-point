# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-09) — IMPRESION DEL TICKET (spec 0184, ADR 0133) IMPLEMENTADA EN `dev` (`c264dbf`); FALTA LA UI DE GPT

**En PROD (`main` = `origin/main` = `3e26701`):** sin cambios. CI de `main` rojo por los e2e de tours (conocido:
`pnpm verify` nunca verde); no se toco esta sesion.

**En `dev`, sin pushear (van con el proximo push, con OK):** lo de antes (mesas `cc1eb17` y 0067 NO en PROD,
`838a33d`, `8660441`, `802337e`, `97e774f`, `647e81f`, `bb04fd4`, `4d942ce`) mas:
- `06f7cc4` ADR 0133 + spec 0184 + PARQUEADO #86 (panel instalable como PWA que abre el POS; owner: «retomarlo pronto»).
- `c264dbf` **spec 0184 implementada** (L2): migracion **0068** `core.ticket_settings` (nombre del comercio y mesa,
  opcionales por comercio, ninguno obligatorio, defaults `true`); `GET`/`PUT /api/merchant/business/ticket` (owner)
  y `GET /api/pos/ticket` (permiso `pos`); modulo `apps/merchant/src/printing/` (README con contrato y recetas) en
  tres capas: `TicketDoc` → ESC/POS 58/80 mm sin acentos → BLE / Web Serial; impresora (por nombre, lista filtrada)
  y papel en `localStorage`. Bloque QR listo, vacio hasta la spec B. Borrados `/prueba-impresora` y su bitacora.
  Medido: Neon 7/7 (0068 aplicada en la rama de CI), unitarios `printing` 23/23, merchant 2208 passed / 991 skipped,
  lint 0, tsc 0; M1, M2, M3b rojas por su motivo; M3 sobrevivio (linea redundante, borrada). Encargo a GPT:
  `docs/encargo-gpt-2026-10-09-impresion.md`.

**QUE SIGUE:**
1. **GPT**: botones, ajuste «Impresora» por dispositivo, pantalla del owner para el ticket (encargo de arriba).
2. **Prueba de campo** cuando GPT cablee el boton: orden real en la WD-58P1, dos tickets seguidos sin lista, tras
   recargar la lista muestra solo esa impresora. Sin medir: Web Serial contra impresora real, QR en papel.
3. **0068 a PROD** con OK del owner, en el proximo pase a live (snapshot antes), junto con la 0067.
4. **Spec B — venta reclamable por QR** (L3, PARQUEADO #85, decisiones del owner ahi): llena `buildTicket(..., { qr })`.
- Base local: la 0068 se aplica al levantar el entorno (`/entorno-local arrancar`); no se levanto.

**Pendiente / abierto (de antes):** PARQUEADO #83 (mesas: UI de GPT, 0067 a PROD, push), #82 (staging), #86 (PWA),
deuda `no_program` (R3 0169), `pnpm verify` nunca verde (e2e de tours), Colima antes de `pnpm dev:local`.
- Arbol: `.claude/skills/gotchas-del-repo/SKILL.md` y `docs/LECCIONES.md` modificados por otra sesion, sin
  commitear: no tocar.
- Hallazgo a decidir (zona GPT): `loyalty-api.ts` descarta el `error` del servidor; en el cuadro del TOS se ven las `{{llaves}}`.
- El owner compra un ESP32 WROOM-32 para un puente futuro (seria otro `printing/transport/`); idea, sin spec.

**Descartado (no reintentar sin dato nuevo):** la tabla del bloque historico 2026-10-09 tarde (Web Serial para la
WD-58P1, `window.print()` de Android, TV box, telefonos desarmados, cajita MFi, servidor local) mas: guardar la
impresora BLE en nuestra base (Chrome no acepta un dispositivo que el usuario no eligio en su lista).

**Decisiones del owner, no volver a preguntar:** las de antes, mas (2026-10-09): Claude la API y GPT los botones;
ticket = base fija (items, cantidad, unitario, total, fecha, hora, QR) + nombre y mesa opcionales por comercio
EN LA BASE con pantalla; sin leyenda de precuenta; sin acentos; impresora recordada por nombre; QR opcion A; PWA
parqueada; ajuste por comercio, solo el owner lo edita, hora de la impresion (aceptados al cerrar la spec).
