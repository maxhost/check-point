# Spec 0088 — bitacora de mutaciones de la ENMIENDA §11

Las cinco mutaciones del **cierre** de la 0088: las que prueban que los oraculos nuevos —los que
nacieron de los seis hallazgos de la revision independiente— **muerden**. Las cinco filas se
abrieron **antes** de medir, con el `shasum` limpio de cada archivo tomado sobre el arbol posterior
a los arreglos.

La bitacora del implementador (las 4 mutaciones del presupuesto original) y la de la revision (5
propias, todas ejecutadas contra `8ee91d1`) estan en el handoff de la spec.

## Copias limpias

`/tmp/limpias-0088/` — el punto de retorno de cada archivo, y contra lo que se corre el `diff`
al revertir.

| archivo | `shasum` limpio |
|---|---|
| `backoffice/staff/page.tsx` | `f2a7b3ab7ba371a97257f5d287891e6b1e5320a6` |
| `backoffice/staff/staff-tour-definitions.ts` | `9aa2beec15c16bb1755652c3ccefaecaa7082f62` |
| `backoffice/staff/staff-contract.ts` | `9234d1e6556163fd3995d121472ce79b1bfd6a4f` |

## Las cinco filas

| id | archivo | invariante atacado | oraculo que tiene que morder | resultado ejecutado |
|---|---|---|---|---|
| RM1 | `staff/page.tsx` | el gate de permiso de la pantalla (hallazgo **H1**: la revision lo borro y 1.526 tests siguieron verdes) | `page-guard.test.ts` | **ROJO, y por la asercion correcta.** `page-guard.test.ts` → **2 casos rojos**: *«promise resolved "{ …(10) }" instead of rejecting»* — la pagina devolvio la consola en vez de rebotar. `2 failed | 138 passed` sobre 17 archivos de `backoffice/` |
| RM2 | `staff-tour-definitions.ts` | el paso de Mostrador **no** autoavanza (hallazgo **H2**: el clic APAGA el unico permiso puesto) | `staff-tour-definitions.test.ts` | **ROJO.** *«no autoavanza en el paso de Mostrador: pulsarlo lo APAGARIA»* → `AssertionError: expected true to be false`. `1 failed | 139 passed` |
| RM3 | `staff-contract.ts` | la pantalla ofrece los **siete** permisos del catalogo cerrado (hallazgo **H4**) | `staff-contract.test.ts` | **ROJO.** *«ofrece exactamente los siete permisos del catalogo»* → `expected [ 'brand','catalog','counter', …(3) ] to deeply equal [ …(4) ]`. `1 failed | 139 passed` |
| RM4 | `staff-tour-definitions.ts` | ninguna **ayuda** persiste progreso del onboarding (la revision rompio el cableado y nadie se puso rojo) | `staff-tour-definitions.test.ts` | **ROJO.** *«ninguna ayuda persiste progreso del onboarding»* → `expected true to be false`. `1 failed | 139 passed` |
| RM5 | `staff-tour-definitions.ts` | el arranque por query **discrimina**: otra query no lanza el tour | `staff-tour-definitions.test.ts` | **ROJO.** *«no arranca con otra query, ni sin query»* → `expected true to be false`. `1 failed | 139 passed` |

**Alcance de cada corrida:** toda la suite de `src/app/backoffice/` del paquete merchant
(`vitest run src/app/backoffice/`), no solo el archivo del oraculo — asi se ve tambien el rojo
colateral si lo hubiera.

**Nota sobre lo que NO se muta, y por que:** el `href` que empuja el checklist y el query que la
pantalla parsea salen **de las mismas dos constantes** desde esta enmienda, asi que mutar una las
mueve a las dos y el test sigue verde **con razon**: la desincronizacion que la revision midio
(romper el query param sin poner rojo a nadie) dejo de ser posible por construccion, y eso es mas
fuerte que un test. Lo que si tiene oraculo es que `wantsStaffOnboardingTour` **discrimine** — RM5.

## Cierre

**Las cinco dieron ROJO y por la asercion correcta**, cada una acusando la propiedad que ataca y
no el setup. Las cinco revertidas con `cp` de la copia limpia y `diff` **vacio**; los tres
`shasum` posteriores son identicos a los de la tabla de arriba. `grep -rn MUTATION apps/merchant/src`
→ **sin resultados**.
