#!/usr/bin/env bash
# UserPromptSubmit — avisa cuando el contexto pasa el techo y pide handoff.
#
# POR QUE UN TECHO ABSOLUTO Y NO UN PORCENTAJE
# El "40-60% de la ventana" que circula no tiene ningun estudio detras, y ademas
# usa la unidad equivocada: el context rot es ABSOLUTO, no relativo.
#   - NoLiMa (ICML 2025): a 32K tokens, 11 de 13 modelos caen por debajo del 50%
#     de su baseline de <1K.
#   - Databricks (13 modelos): inicio de degradacion en 16k / 32k / 64k segun modelo.
# Con ventanas de 1M, un porcentaje da falsa sensacion de margen justo donde el
# modelo ya se perdio.
#
# WARN_TOKENS es un juicio anclado a la region medida, no un numero derivado.
# Ajustar con la experiencia.

set -uo pipefail
WARN_TOKENS="${CONTEXT_WARN:-100000}"

input=$(cat)
t=$(printf '%s' "$input" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{process.stdout.write(JSON.parse(s).transcript_path??"")}catch{}
  })' 2>/dev/null)

[ -n "$t" ] && [ -f "$t" ] || exit 0

used=$(node -e '
  const fs=require("fs");
  let lines;
  try{ lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n"); }catch{ process.exit(0) }
  for(let i=lines.length-1;i>=0;i--){
    try{
      const j=JSON.parse(lines[i]);
      const u=j.message?.usage;
      if(u && !j.isSidechain){
        // Contexto ocupado = input + cache_creation + cache_read.
        // output_tokens NO cuenta: no ocupa contexto de entrada.
        console.log((u.input_tokens||0)+(u.cache_creation_input_tokens||0)+(u.cache_read_input_tokens||0));
        break;
      }
    }catch{}
  }' "$t" 2>/dev/null)

[ -n "${used:-}" ] || exit 0
[ "$used" -le "$WARN_TOKENS" ] && exit 0

cat >&2 <<EOF
[contexto: ${used} tokens, techo ${WARN_TOKENS}]

Pasaste el techo. La evidencia dice que a partir de aca la degradacion es
cualitativa, no gradual: no vas a "andar un poco peor", vas a empezar a perder
instrucciones y a no recuperarte de giros equivocados.

Antes de seguir con trabajo nuevo, hace handoff:
  1. Actualiza docs/TASKS.md con el estado real (que quedo hecho, que no, que sigue).
  2. Escribi lo aprendido que no este ya en disco (decision -> ADR, hallazgo -> spec).
  3. Commitea.
  4. Deci que el handoff esta listo y que conviene sesion nueva.

Una sesion limpia con un buen prompt casi siempre le gana a una sesion larga con
correcciones acumuladas. El punto de retorno es TASKS.md, no este chat.
EOF
exit 0
