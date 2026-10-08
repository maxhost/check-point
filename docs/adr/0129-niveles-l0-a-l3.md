---
adr: 0129
fecha: 2026-10-08
estado: aceptada
resumen: Los niveles de trabajo pasan a L0 (rapido, sin spec ni pruebas), L1 (chico, mini plan y pruebas de menos de 3 min), L2 (funcionalidad nueva, spec chica, ADR opcional, tests especificos) y L3 (grande, spec + ADR + tests + implementador y revisor). Dinero, login/sesiones, aislamiento entre comercios y migraciones a PROD nunca bajan de L2; ante la duda entre dos niveles se le pregunta al owner. Reemplaza los N0-N2 de la spec 0151.
---

# 0129 — Niveles de trabajo L0 a L3

## Contexto

La spec 0151 definio N0/N1/N2. El owner, 2026-10-08, los redefine para que lo chico sea rapido:

- «L0 = cosas rapidas que no necesitan spec ni adr, simplemente investigas lo que vas a hacer y aplicas, por ejemplo
  cambio de un color, un texto, una imagen. revisas que el codigo implementado esta bien, pero nada de
  adversariales, ni pruebas.»
- «L1 = algo ligeramente mas grande, por ejemplo añadimos una seccion, modificamos el layout, un cambio pequeño en la
  base de datos que no sea aditivo, ni eliminar, por ejemplo modificar algo. requiere un mini plan no una spec
  completa, ni adr. Pruebas minimas, nada que lleve mas de 3 minutos.»
- «L2 = son funcionalidades nuevas, requieren ya una spec pequeña, quizas un ADR pero no obligatorio, pruebas
  especificas pero no extensas, no requiere adversarial a no ser que notes algo extraño.»
- «L3 = cambios grandes aplicamos toda la suit, spec, adr, tests.»

Preguntado el mismo dia: dinero, login/sesiones, aislamiento entre comercios y migraciones a PROD → **«Minimo L2»**.
Duda entre dos niveles → **«Te pregunto»**.

## Decision

La tabla de `CLAUDE.md` §Niveles. Subagentes (`implementador`, `revisor`) solo en L3. `pnpm verify` completo corre al
pasar a live (hook `pre-push`, ADR 0128), no en cada cambio L0/L1.

## Consecuencias

- **Hallazgo a decidir (no lo dijo el owner):** un cambio de base L1 («modificar algo») que termine en una migracion a
  PROD cae bajo el piso L2. Hasta que el owner lo aclare, se le pregunta en cada caso (regla de la duda).
- L0 conserva una señal minima (typecheck + lint del paquete tocado): no es una prueba, es la revision de que el codigo
  compila; la regla madre de `CLAUDE.md` §Verificacion sigue en pie.
