---
adr: 0068
fecha: 2026-09-16
estado: aceptada (decision del OWNER, preguntada al empezar la fase D2 de la spec 0065)
resumen: La spec 0065 pide que el opt-out de promociones viva en una RUTA propia del portal del consumidor (`(consumer)/wallet/settings/page.tsx`). El portal no es un arbol de rutas: es un SPA de dos pestañas que `wallet-shell.tsx` conmuta con `useState`, asi que una ruta nueva sale del shell y pierde la barra inferior. Preguntado explicitamente, el owner eligio la TERCERA PESTAÑA. Consecuencia que hay que declarar y no tapar: la seccion NO tiene URL propia, asi que el item del DoD «`/wallet/settings` sin sesion → redirect» deja de existir tal como esta escrito — sin sesion, `/wallet` ya responde la pantalla «Tu tarjeta no esta abierta», que es el mismo aislamiento por otro mecanismo. Lo que NO cambia: la ruta `POST /api/public/consumer/marketing-opt-out` sigue siendo una ruta HTTP de verdad, con 401 sin sesion y 404 sobre una membresia ajena, y ahi es donde vive el aislamiento que importa.
---

# 0068 — El opt-out del consumidor vive en una tercera pestaña, no en una ruta

## Contexto

La spec 0065, en «Portal del consumidor — seccion Configuracion», dice:

> `(consumer)/wallet/page.tsx` gana una entrada **«Configuracion»** →
> `(consumer)/wallet/settings/page.tsx` (misma sesion de consumidor que el portal; sin
> sesion → redirect al portal).

Al relevar el terreno antes de implementar la fase D aparecio que **eso no es lo que el portal
hace hoy**, y que la spec lo escribio sin mirarlo:

- `wallet/bottom-nav.tsx` declara `export type WalletTab = "programs" | "qr"`.
- `wallet-shell.tsx` las conmuta con un `useState` (`:24`), con `initialTab` como prop.
- `wallet/page.tsx` es la **unica** ruta del portal: resuelve la sesion, arma el QR, la lista de
  programas y el manifest dinamico, y renderiza el shell.

O sea que el portal es un **SPA de dos pestañas**, no un arbol de rutas. Las dos salidas tenian
un costo real y opuesto:

- **Ruta propia** (lo que pedia la spec): tiene URL, se linkea y se testea sin simular clicks,
  pero **sale del shell** — pierde la barra inferior y el estado de la pestaña, y hay que
  decidir como se vuelve.
- **Tercera pestaña**: se queda adentro del shell y del `useState`, pero **no tiene URL propia**,
  asi que ningun item del DoD puede nombrarla por URL.

## Decision

**Tercera pestaña.** Preguntado explicitamente con la recomendacion contraria del orquestador
(la ruta, por ser lo que dice la spec cerrada), el owner respondio: «lo prefiero como una tercera
pestaña».

`WalletTab` pasa a ser `"programs" | "qr" | "settings"`, `BottomNav` gana su boton y el shell su
rama. No se crea `(consumer)/wallet/settings/page.tsx`.

## Consecuencias

1. **El item del DoD «`/wallet/settings` sin sesion → redirect» no se puede cerrar como esta
   escrito, y no se reemplaza por un proxy.** Sin URL propia no hay nada a donde navegar sin
   sesion. Lo que si existe y se asevera: **sin sesion, `/wallet` entero** —y por lo tanto la
   pestaña— **responde la pantalla «Tu tarjeta no esta abierta»**, sin tocar la base. El
   aislamiento que de verdad protege el dato vive en la ruta HTTP, no en la pantalla.
2. **`POST /api/public/consumer/marketing-opt-out` no cambia**: 401 sin sesion, 404 sobre una
   membresia que no es del consumidor de la sesion, y escribe `marketing_opt_out_at` unicamente
   de la suya. Ese es el item de aislamiento de la fase D que si se cierra.
3. **La barra inferior pasa de dos botones a tres.** Es el costo de UI de la decision y es del
   owner: una pantalla de ajustes de uso raro ocupa un tercio de la navegacion principal.
4. **El estado de la pestaña sigue sin sobrevivir a un refresh** (es `useState`, no URL). Ya era
   asi para «Mi QR»; la decision no lo empeora ni lo arregla.

## Alternativas descartadas

- **La ruta de la spec**, descartada por el owner con la pregunta ya hecha.
- **Una ruta + `?tab=`**, que daria URL y shell a la vez: no se propuso porque el owner ya habia
  elegido, y agregar un mecanismo nuevo de estado por query string para una pantalla de ajustes
  es mas superficie de la que la decision pedia. Queda anotada por si el estado por URL hace
  falta despues.
