# AGENTS.md

Codex: reglas comunes en `docs/TRABAJO-EN-PARALELO.md`, roles en `docs/AGENT-WORKFLOW.md` y checks en `docs/VERIFICACION.md` (ADR0144). Lee tu tarea/contrato y solo contexto pertinente. Coordinador lee el bloque vigente de `docs/estado/gpt.md`; workers no editan estados/indices comunes.

- GPT puede implementar UI y backend dentro de los paths de su encargo. Kit/guardias/tooling/migraciones necesitan asignacion explicita; spec0225 autoriza el harness del piloto.
- Dev es base/integracion. Worker usa worktree/ref local asignados; no cambia ramas del checkout principal. Main local recibe candidato tras QA; **cada push/operacionPROD requiere autorizacion explicita para ese caso**. Nunca push de feature/dev.
- Autonomía autorizada por owner: dentro del encargo, editar, instalar dependencias, preparar/retirar worktrees propios, commit/merge local, ejecutar comprobaciones proporcionales, operar DB de desarrollo/CI protegidas y levantar servidores/túnel no requieren otra confirmación de tarea. **Push y migraciones de DB de producción siempre esperan autorización explícita del owner para ese caso**; una autorización técnica guardada o auto-review no la sustituye. Los permisos del sandbox se resuelven por la configuración de Codex; si bloquean un worker, avisar de inmediato al coordinador, no quedar esperando en silencio ni confundirlo con un fallo del producto.
- Dos implementadores que tambien corrigen, un coordinador y QA independiente. No subdelegar ni crear reviewers extra por defecto. Specs funcionales cerradas; L0/L1 sin spec universal.
- Node24: `source ~/.nvm/nvm.sh && nvm use` antes de comandos.
- Modulos: `docs/MODULOS.md`; UI en `modules/<id>/ui`, no rutas/nombres del modulo en core. Contratos HTTP escritos aunque un agente haga ambas capas.
- Merchant usa kit; guardia UI sin nuevos nativos/handlers/style/paleta cruda/tipografia arbitraria/CSS. No editar kit/guard para evitar el rojo.
- Copy: `apps/merchant/COPY.md`, tuteo.
- Tests DB solo `tools/neon-test.sh`, nunca DATABASE_URL de PROD. Configuracion de worktrees seleccionada, no copiar env productivos.
- Evidencia observable ligada al SHA/entorno; no afirmar PASS por skips/retries ni modificar tests para esconder fallos. QA de entrega y de combinacion son distintos.
- `node tools/factory.ts`: reservas, entrega, aceptacion y cleanup. Retirar worktree limpio solo con entrega aceptada ancestro de main local, sin procesos ni pendientes. No force/discard de trabajo ajeno.
- Indices/specs se reservan por commit local del coordinador antes del codigo, sin push de reserva. Hooks instalados y pre-push vigente sin bypass.
