---
adr: 0046
fecha: 2026-09-02
estado: aceptada
resumen: El proyecto sigue la Active LTS que Vercel ofrece como runtime, no la Current de Node. Hoy eso es 24.x. Node 26 es Current desde mayo 2026 pero Vercel no lo ofrece, así que migrar ahora dejaría a local/CI en 26 y a producción en 24 — el CI dejaría de probar lo que corre en prod. La versión pasa a tener una sola fuente de verdad con guard contra el drift.
---

# 0046 — Versión de Node: seguir la LTS de Vercel, no la Current de Node

## Contexto

Se pidió un plan para subir Node "a la última versión estable disponible". La pregunta
tiene dos respuestas distintas según qué signifique "disponible", y la diferencia es la
decisión completa.

**Lo que hay (verificado contra `nodejs.org/dist/index.json` y el `schedule.json` oficial
el 2026-09-02, no de memoria):**

| Versión | Estado | Fechas |
|---|---|---|
| **26.8.1** | Current (impar en su ventana previa a LTS) | salió 2026-08-26 · **LTS el 2026-10-28** · EOL 2029-04-30 |
| 25.9.0 | **EOL** | murió 2026-06-01 |
| **24.20.0** | **Active LTS** (Krypton) | salió 2026-08-26 · maintenance 2026-10-20 · EOL **2028-04-30** |
| 22.23.2 | Maintenance LTS (Jod) | — |

**Lo que Vercel ofrece como runtime** (`vercel.com/docs/functions/runtimes/node-js/node-js-versions`):

> Current available versions are: **24.x (default)**, **22.x**, **20.x**.

**Node 26 no existe como runtime en Vercel.** Verificado además contra la cuenta real:
`vercel project ls` muestra `check-point → 24.x`, igual que los otros 9 proyectos.

**Dónde vive hoy la versión en este repo** — en cuatro lugares que nadie mantiene en sync:

| Lugar | Valor |
|---|---|
| `.node-version` | `24.19.0` |
| `package.json` → `engines.node` | `>=24.15.0 <25` |
| `@types/node` (×3 apps) | `24.10.1` |
| Vercel → Project Settings | `24.x` |

## Decisión

**1. El proyecto sigue la Active LTS que Vercel ofrece como runtime. Hoy: la línea 24.x.**

No se migra a Node 26 ahora, aunque sea la última release estable de Node.

**2. La versión de Node tiene una sola fuente de verdad (`.node-version`), y un guard
automatizado verifica que los demás lugares no se desincronicen.**

**3. El salto a 26 es un evento agendado, no una decisión pendiente.** Se dispara cuando
se cumplan **las dos** condiciones: (a) Node 26 entró en LTS (2026-10-28, fecha del
calendario oficial) **y** (b) Vercel lo ofrece en el dropdown de Project Settings. La (b)
es la que manda: la (a) sin la (b) no habilita nada.

## Motivo

**El argumento decisivo es el skew, no la novedad.** Si local y CI corren 26 y producción
corre 24, el CI deja de probar lo que se despliega. Este repo acaba de salir (specs 0047 y
0048) de tener un CI que no verificaba nada; introducir a mano una divergencia entre el
runtime probado y el desplegado sería reintroducir el mismo problema por otra puerta, y
peor: silenciosa, porque todo estaría en verde. Un CI que prueba un runtime que nadie
despliega es exactamente el tipo de señal falsa que veníamos de eliminar.

**El techo no es negociable desde el repo.** Vercel no permite elegir 26.x ni por
`engines`, ni por `.node-version`, ni por dashboard. Un `engines: "26.x"` no despliega
Node 26: o falla, o Vercel resuelve a otra cosa. No hay forma de "adelantarse" con código.

**No hay presión de fin de vida.** Node 24 tiene soporte hasta **2028-04-30**, casi 20
meses. Entra en maintenance el 2026-10-20, lo que significa parches de seguridad, no
abandono. No estamos postergando una migración urgente: estamos evitando una prematura.

**El costo de esperar es cero y el de adelantarse es real.** Esperar no cuesta nada:
mismas features del lenguaje que ya usamos, mismo soporte. Adelantarse cuesta un CI que
miente, más el riesgo de que una dependencia (Next 16, better-auth, drizzle, sharp —
`sharp` tiene binarios nativos por versión de Node) se comporte distinto en el runtime que
nadie despliega.

## Alternativas consideradas

- **Migrar a Node 26 ya, en local y CI, dejando prod en 24.** Rechazada: es exactamente el
  skew descrito. Su único beneficio —"estar al día"— es cosmético mientras el deploy siga
  en 24.
- **Migrar todo a 26 incluyendo prod.** Imposible hoy: Vercel no lo ofrece. No es una
  alternativa, es un deseo.
- **Quedarse en 24.19.0 y no hacer nada.** Rechazada por lo menor pero real: el pin local
  quedó un patch atrás de la LTS (24.20.0), y sobre todo persiste el problema de fondo —
  la versión repetida en 4 lugares sin nada que verifique que coinciden. Esa deuda es la
  que hace cara la migración a 26 cuando llegue.

## Consecuencias

- **Ahora:** `.node-version` pasa a `24.20.0` (última LTS), `@types/node` se alinea a la
  línea 24, y entra un guard que falla si los pines divergen. Producción **no cambia**:
  Vercel ya sirve "la última 24.x" y aplica minors/patches solo. Lo que se corrige es el
  entorno de desarrollo y CI, que hoy prueba contra una versión más vieja que la desplegada.
- **A partir del 2026-10-28**, con Vercel ofreciendo 26.x, la migración es un cambio de
  una línea en `.node-version` + el mismo valor en el dashboard, porque el guard garantiza
  que no quedó ningún pin suelto. Ese es el verdadero entregable de esta decisión: no la
  versión de hoy, sino que la de mañana sea barata.
- **Queda una fecha en el calendario, no un pendiente difuso.** Si nadie la mira, el peor
  caso es seguir en una LTS soportada hasta 2028.
