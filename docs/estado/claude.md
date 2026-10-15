# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-15) — PLAN COSTO/MARGEN → SMART MENU: R1, P1 Y P3 CERRADOS CON EL OWNER; PROMPTS LISTOS

**Sesion de diseño con el owner, sin codigo.** Claude piensa con el owner y prepara prompts; GPT escribe specs e
implementa (ADR 0144). Fuente de verdad: **`docs/plan-margen-ganancia-2026-10-14.md`** (commit `223337c8`): tabla de
etapas, decisiones del owner por pieza (secciones «R1 — huecos cerrados», «P1 — decisiones», «P3 — decisiones» con dos
rondas) y prompts listos para GPT. Investigacion de Ecuador para el catalogo de P1:
`docs/investigacion-medios-de-pago-ecuador-2026-10-15.md` (fuentes de prensa/proveedores, contradicciones marcadas).

**Estado de las piezas (leido en git el 2026-10-15, no corri gates):**
- **0230** (costo de lo vendido) implementada, QA PASS (`docs/factory/0230-0231-qa.md`); **0231** (Rentabilidad: costos
  fijos y sueldos, backend sin UI) implementada, QA PASS (`docs/factory/0231-qa.md`), ADR 0147 aceptado. Ambas en `main`
  local (`d1e0710f`); **`main` local va 65 commits adelante de `origin/main`: nada pusheado**. La spec 0231 sigue
  diciendo `estado: cerrada` (descuido de GPT).
- **R1** spec 0232 + ADR 0148: GPT redactando en worktree `r1-0232-spec`; le pregunto 3 cosas (archivo, nombres
  duplicados al migrar, redondeo/procedencia): respuesta sugerida dada al owner, sin confirmar que la envio.
- **P1** spec 0233 + ADR 0149: GPT pregunto 4–8; respuesta sugerida dada (cambio en la 5: cobrado 0 no pide medio).
  Owner pidio sumar a la 0233 el **descuento por linea en la version 2 de `sale.closed`** (mensaje para GPT dado).
- **P3** spec 0234 + ADR 0150: prompt listo, sin lanzar. Implementa despues de P1.

**Que sigue:** prompts de **1.3** (despues de cerrar la spec de R1; necesita ADR de enganche «modulo aporta el costo
del producto» al Catalogo), **P2**, **6** y **SM-datos**; UI pendiente con el owner: Rentabilidad (costos fijos en
Locales, sueldo en Equipo), Recetas, selector de medio en el POS, Smart Menu + Dashboard (ADR de enganche).

**Gotchas de esta sesion:** comercios de **Ecuador (USD)**; redondeo a la **unidad minima de la moneda**, no
«centavos» (COP/CLP sin fracciones). Stock y costo son **por local** a proposito; recetas por comercio; compra
central = una carga por local, sin transferencias. «Todo es un cupon»: el canje de premio hoy NO emite cupon
(`counter/redemptions.ts`) y todo cupon exige campaña. S1/S2 (comision del profesional, duracion del servicio) fuera.
