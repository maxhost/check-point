---
adr: 0071
fecha: 2026-09-17
estado: aceptada
resumen: El proceso se recorta por decision del owner, medido: spec chica para cambios de un dominio, decisiones del owner antes de la prosa, UN implementador y UN revisor por spec (no por paso), filas de INDEX de 3 lineas y gates completos una vez por spec. No se toca el protocolo de mutaciones ni la revision independiente, que son los que muerden.
---

# 0071 — El proceso se recorta: spec chica y un solo ciclo de revision

## Contexto

El owner pregunto por que un cambio chico —`GET /api/staff` mas el `StaffDTO` sin `email`—
costo cerca de una hora. **Medido en esa tanda, no estimado:**

| Etapa | Tiempo | Tools | Tokens |
|---|---|---|---|
| Implementador paso 1 | 18 min | 71 | 179k |
| Revisor independiente | 9 min | 40 | 106k |
| Implementador cerrando el FAIL | 8 min | 18 | 208k |

**Los comandos NO son el cuello.** Una ronda entera de gates es **menos de 1 minuto**:
`typecheck --force` 2,1 s · `lint` ~3 s · `format:check` ~2 s · `test` (1027 casos) 15 s ·
`build --force` 5,7 s · los `.neon` de staff 11-16 s. Se corrieron ~6 rondas: ~6 min de ~60.

**El tiempo se va en texto generado y contexto re-leido: 493k tokens entre tres agentes.** Las
cinco fugas medidas:

1. La spec se escribio **dos veces** (456 lineas y despues 324) porque el recorte de alcance del
   owner llego **despues** de la prosa.
2. Las filas del `INDEX` son de **1.500-2.000 palabras** cada una, y se cargan en cada sesion.
3. La mutacion de la fuga del email sintetico se corrio **4 veces** entre implementador, revisor
   y orquestador.
4. El ciclo FAIL → fix → re-verificacion costo ~15 min.
5. Todo se verifico contra Neon, incluso donde un doble alcanza (10-16 s por archivo).

## Decision

El owner acepto el 2026-09-17:

1. **Spec chica** (`docs/specs/TEMPLATE-CHICA.md`, ~60 lineas) para cambios de **un solo
   dominio, sin esquema y sin decision de producto**: problema, alcance, DoD, tabla de
   mutaciones y archivos. La plantilla larga (`TEMPLATE.md`) queda para arcos como el 0067.
2. **Las decisiones del owner se piden ANTES de escribir prosa.**
3. **UN implementador y UN revisor por spec**, no por paso.
4. **Filas de `INDEX` de 3 lineas**: que es, por que importa, estado. El detalle vive en la spec.
5. **Gates completos una vez por spec**, no una por agente.

## Lo que NO se toca, y por que

**El protocolo de mutaciones y la revision independiente se quedan enteros.** En esta misma
tanda el revisor encontro que el DoD pedia un oraculo contra la fuga del email sintetico y **ese
oraculo no existia** para 2 de las 5 rutas: la fuga escrita por fuera de `toStaffDTO`
(`{...toStaffDTO(…), email}`) sobrevivia a `typecheck`, a 1027 tests y a los 4 `.neon` de staff.
Sin esa ronda se habria marcado como hecho algo que no lo estaba. Los ~15 min del ciclo FAIL se
pagan; los otros ~30 no.

**Tampoco se toca la regla de reproducir la evidencia de un subagente** — pero alcanza con **la
señal decisiva**, no con repetir todas sus mediciones.

## Consecuencia esperada

De ~60 min a ~25 para un cambio de esta clase. **Se mide contra la proxima spec chica** y el
numero real vuelve a este ADR.
