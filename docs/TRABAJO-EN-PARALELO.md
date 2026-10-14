# Trabajo en paralelo por tarea

Reglas vigentes: ADR0144 sustituye reparto fijo GPT/Claude, carpeta unica y subagentes soloL3 de ADR0071/0113/0114/0128/0129. Las decisiones de producto/arquitectura anteriores siguen vigentes salvo sustitucion explicita.

## Inicio y ramas

Coordinador: Node24, estado propio vigente, `git status --short`, refs reales y `pnpm ci:status`; no pull/switch sobre trabajo ajeno. CI remoto rojo se identifica y su correccion debe estar en el candidato antes de publicar. Dev es punto de partida/integracion, no se pushea. Main local representa lo listo, origin/main lo publicado. No exigir publicacion previa para iniciar desde dev aprobado.

Workers: leer ficha/spec cerrada/contrato, confirmar worktree/base y scope antes de escribir. No operar indice, refs, estados, servidores o artefactos de otro checkout. UI/backend pueden ser de GPT o Claude; mantenimiento de kit/tooling/esquema solo por encargo explicito.

## Aislamiento y recursos

Dos workers y QA, maximo tres worktrees operativos. `tools/worktree-new.sh NAME BASE ROOT` prepara dependencias propias; sin enlaces generales de .envPROD. Puertos/artefactos propios; usar bases de prueba aisladas o reservar DB durante migracion/test/limpieza. Generar journals/snapshots en orden, no merge textual de migraciones concurrentes.

El coordinador reserva paths y recursos con `node tools/factory.ts reserve ID WORKTREE BASE PATHS RESOURCES`. Paths son archivos/directorios relativos sin globs. Cada tarea tiene base/contrato/criterios/checks; ampliacion de scope vuelve al coordinador. Contratos/registros/lockfile/INDEX/kit tienen un writer asignado. Worktrees no son frontera de seguridad: las herramientas/permisos y validacion de entregas complementan la regla.

## Entregas, QA e integracion

Worker commitea solo archivos propios y entrega SHAs/evidencia/limites. `factory deliver ID` rechaza checkout sucio y paths fuera de scope. QA parte de spec/diff en contexto fresco, trabaja sobre candidato congelado y devuelve PASS/FAIL reproducible. Coordinador registra `factory accept ID SHA` solo con esa evidencia.

Integrar ramas locales con merge que preserve los commits aceptados, comprobando rango/scope; nunca incorporar una rama ajena por nombre solamente. Dev puede seguir cambiando mientras QA verifica una copia congelada. Correccion genera otra revision y solo invalida checks afectados; no copiar PASS de otro candidato. Worker puede comenzar otra tarea preparada si hay capacidad y preserva entrega/recursos anteriores.

## Main local y produccion

Tras QA/gates del candidato, avanzar main local al candidato aprobado (fast-forward cuando sea posible), desde un checkout limpio. Volver a dev para seguir. Esto NO publica. El owner decide **cada push a main remoto y cada operacion de produccion**. Confirmar SHA remoto/base/candidato al publicar; si cambiaron, integrar/verificar antes. Pre-push/check-numbers siguen obligatorios; --no-verify solo con autorizacion explicita.

## Limpieza acotada

Cuando la entrega esta en main local: `factory integrate ID`; detener procesos propios; `factory cleanup ID`. Exige estado aceptado/integrado, checkout limpio, ancestro de main y sin procesosCWD. Retira worktree y rama local ya integrada, nunca force. Owner autorizo esta limpieza al adoptar el piloto. Si hay pendientes o archivos ajenos, conservar e informar; no borrar para ahorrar espacio. Evidencia/handoff y commits quedan en el repo; registro local en .factory ignorado por Git.

## Estado y reservas documentales

Coordinador reserva spec/ADR y filaINDEX mediante commit local antes del codigo. Workers escriben entrega propia, no INDEX/TASKS/gpt.md/claude.md. Cada coordinador mantiene su estado; no escribir el del otro. Resolver colisiones documentales preservando las filas de ambos. Ante cancelacion/caida: preservar commits, reconciliar procesos/refs y no reasignar writer vivo. Registro tiene lockatomico; nunca robar lock por timeout.
