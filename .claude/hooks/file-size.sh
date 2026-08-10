#!/usr/bin/env bash
# PostToolUse (Write|Edit) — avisa cuando un archivo pasa el limite de tamaño.
#
# Honestidad sobre esta regla: NO hay estudio que ligue tamaño de archivo con
# tasa de exito del agente. La mantenemos igual por dos razones concretas: el
# equipo de Codex de OpenAI la enforcea mecanicamente en el codebase
# agent-native mas exitoso que se conoce, y el truncamiento de la tool Read es
# real (las respuestas de tools se truncan por tokens).
#
# Va como hook y no como frase en CLAUDE.md porque asi cuesta cero tokens y no
# depende de que el modelo se acuerde. Es PostToolUse, no Stop: es una señal,
# no un bloqueo — dividir un archivo a mitad de una tarea puede ser peor que
# terminarla y dividir despues.

set -uo pipefail
LIMIT=300

input=$(cat)
f=$(printf '%s' "$input" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}
  })' 2>/dev/null)

[ -n "$f" ] && [ -f "$f" ] || exit 0
case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac

n=$(wc -l < "$f" | tr -d ' ')
if [ "$n" -gt "$LIMIT" ]; then
  printf '%s tiene %s lineas (limite %s). Dividir, no extender.\n' "$f" "$n" "$LIMIT" >&2
  exit 2
fi
exit 0
