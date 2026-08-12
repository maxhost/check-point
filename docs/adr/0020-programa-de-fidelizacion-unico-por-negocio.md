---
fecha: 2026-08-10
resumen: Cada negocio puede no tener programa o tener exactamente uno activo; puntos, sellos, niveles y cashback son modalidades excluyentes y versionadas.
estado: aceptada
---

# ADR 0020 — Programa de fidelización único por negocio

## Contexto

El negocio necesita elegir una mecánica de fidelización comprensible para su operación.
Puntos, sellos, niveles y cashback no son simples etiquetas visuales: producen saldos,
progresos, reglas de canje y pasivos económicos distintos. Permitir varias modalidades
activas desde el inicio haría ambigua la wallet, la configuración de campañas, el canje y
las métricas.

Además, los sellos comerciales no son los sellos o coleccionables de Mi Pasaporte. Estos
últimos reconocen actividad en la red y son activos de plataforma; una tarjeta de sellos
de un bar es un programa y beneficio exclusivo de ese negocio.

## Decisión

- Un `loyalty_program` pertenece a un `business_id`. Puede estar `inactive` o `active`;
  sólo puede existir **uno activo por negocio**. Sus locales activos lo heredan.
- Sus modalidades tipadas son `points`, `stamps`, `tiers` y `cashback`. La modalidad y su
  configuración publicada se versionan; no se cambian retroactivamente sobre actividad,
  saldos, progresos o canjes ya registrados.
- Un negocio puede no tener ningún programa activo. Las campañas y sus cupones siguen
  pudiendo existir, pero no pueden emitir una recompensa que requiera un programa
  inexistente o incompatible.
- La interfaz demo inicial sólo deja activar `points` o `stamps`. `tiers` y `cashback`
  quedan modelados y no seleccionables hasta cerrar economía, retención, canje y riesgo
  financiero correspondientes.

### Modalidades

| Modalidad | Saldo/progreso | Configuración mínima futura |
|---|---|---|
| `points` | Libro mayor y saldo no negativo por cuenta y negocio | nombre de unidad, expiración, reglas de acumulación y catálogo de premios/costes en puntos |
| `stamps` | Progreso de tarjeta por cuenta, negocio y versión | nombre de tarjeta, cantidad objetivo, reglas de obtención y premio al completarla |
| `tiers` | Nivel vigente y métrica calificadora por cuenta y negocio | niveles ordenados, umbrales, periodo de evaluación/conservación y beneficios por nivel |
| `cashback` | Libro mayor de crédito monetario por cuenta y negocio | moneda, porcentaje/reglas de acumulación, topes, expiración y reglas de uso/canje |

Una campaña sólo configura la emisión elegible mediante el Incentive Engine; el programa
define qué efecto es compatible y cómo se presenta o canjea. Cupones y créditos de juego
son derechos de campaña separados, no una quinta modalidad de fidelización.

Desactivar o sustituir un programa no borra historia. Antes de que se habilite el cambio
de modalidad en producción se deberá definir una política explícita para los saldos o
progresos pendientes. No se migran ni convierten automáticamente en V1.

## Consecuencias

- La home del owner tendrá un acceso propio **Programa de fidelización**, separado de
  Marca, Configuración y Campañas. Mostrará si está desactivado y su modalidad activa.
- La pantalla de programa configura la modalidad; Campañas consume esa configuración y
  no presenta efectos incompatibles.
- Wallet, operación y métricas identifican siempre `business_id`, programa y versión.
  Nunca agregan puntos, sellos, niveles o cashback entre negocios.
- El modelo de wallet distingue `merchant_stamp_progress` de `passport_asset` de tipo
  `stamp`; no se reutiliza la misma entidad ni se mezclan sus reglas de expiración.
- Cashback requiere revisión legal, contable y económica antes de habilitarse; niveles
  requiere cerrar su métrica calificadora y beneficios. Ambos quedan fuera de la UI demo
  inicial, no fuera del modelo de producto.

