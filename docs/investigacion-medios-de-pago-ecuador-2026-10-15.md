# Investigación — medios de pago en Ecuador para el catálogo de P1 (2026-10-15)

Insumo para la spec **0233 (P1, medio de pago y comisiones)**. Lo investigó Claude por encargo del owner. Sirve para
cargar el **catálogo de plataforma de Ecuador** (`country_code = EC`). Fuentes: prensa, páginas de los proveedores y
blogs comerciales, **no contratos ni normas vigentes leídas en su texto**. Conviene confirmar con un comercio real o con
el proveedor antes de mostrar estos datos como hechos.

## Cómo se usa (decisiones del owner, plan §P1)

- Un solo nivel: cada entrada es un **medio con su forma de cobro**: `none` (sin comisión), `percent`, `fixed` o
  `percent_and_fixed`.
- **El catálogo no trae tasas.** Las tasas de referencia de abajo son **contexto para el owner y la UI** (p. ej. un
  texto de ayuda), **no valores a precargar**. Sin cargar = 0, con aviso.
- Efectivo nunca se archiva. Las demás entradas se ofrecen al prender el POS y el comercio archiva las que no usa.

## Catálogo propuesto para Ecuador

| # | Entrada (nombre visible) | Tipo | Forma de cobro | Confianza | Por qué |
|---|---|---|---|---|---|
| 1 | Efectivo | efectivo | `none` | alta | Sin procesador. El 49 % de los ecuatorianos prefiere efectivo (McKinsey 2023, vía Primicias) |
| 2 | Tarjeta de débito | tarjeta | `percent` | media | En el datáfono (Datafast/Medianet) la comisión al comercio es un % que cobra el banco adquirente; referencia histórica: 2 % débito |
| 3 | Tarjeta de crédito | tarjeta | `percent` | media | Igual que débito; referencia histórica: ~4 % / 4,02 %. **Sube con diferidos** (meses sin intereses): el % depende del plazo |
| 4 | Transferencia | transferencia | `none` | media | Transferencia bancaria directa a la cuenta del comercio: no hay comisión al comercio por recibir (el costo, si hay, lo paga quien envía) |
| 5 | DeUna | QR | `percent` | media | Soporte oficial de DeUna: **2 % por transacción sobre el monto cobrado** (QR, link, código único). Sus páginas para emprendimientos dicen «gratis»: ver «Contradicciones» |
| 6 | Payphone | link/QR/tarjeta | `percent` | media-alta | 5 % + IVA sobre la comisión; sin fijo, sin mensualidad (dos fuentes coinciden). Saldo de billetera Payphone: sin comisión |
| 7 | Datalink (Datafast, link de pago) | link | `fixed` | baja | Fuente comercial: $12 + IVA al mes y $0,20 + IVA por transacción. El mensual es **costo fijo** (va a F), no comisión por venta. Como comisión por venta queda `fixed` |
| 8 | Peigo | QR / billetera | desconocida | baja | Billetera respaldada por Banco Guayaquil; unos 6.000 comercios (2024). No se encontró su tarifa: proponer `percent` y que el comercio cargue |

**Recomendación para la lista inicial al prender el POS en Ecuador:** 1–6. Datalink y Peigo como entradas del
catálogo que el comercio puede **agregar**, no precargadas (poco uso confirmado o tarifa sin fuente).

**«QR» genérico de la lista base:** en Ecuador lo reemplaza DeUna (decisión del owner). Sigue haciendo falta una
entrada libre «Otro QR / billetera» para Peigo u otros: el comercio puede crear medios libres (P1, decisión 1).

## Notas para la spec

- **Tarjetas: un % por tipo de tarjeta, no por procesador.** Datafast y Medianet son las dos redes de datáfono
  (Datafast es la más grande, con más de 60.000 comercios según un blog comercial; Medianet trabaja con Produbanco,
  Bolivariano e Internacional). El % lo fija el **banco adquirente** en el contrato de afiliación. El comercio sabe
  cuánto le cobran por débito y por crédito; no hace falta que elija la red. Si quiere distinguirlas, crea dos entradas.
- **Diferidos:** el % de crédito cambia según el plazo diferido. Fuera de P1 (una sola tasa por medio); anotarlo como
  hallazgo: el margen de una venta diferida a 12 meses sale con menos comisión de la real.
- **IVA sobre la comisión** (Payphone: 5 % + IVA → 5,75 % efectivo con IVA 15 %). Coherente con «costo = lo pagado»
  (owner), **el comercio carga el % efectivo que le descuentan, IVA incluido**. La ayuda del input puede decirlo.
- **Costos mensuales de los procesadores** (alquiler del datáfono: históricamente USD 22,40–49,84/mes; derecho de
  conexión; mensualidad de Datalink; penalidad por menos de 10 transacciones al mes en contratos de Banco del Pacífico)
  **no son comisión por venta: son costos fijos (pieza F)**.
- **Recargo por pagar con tarjeta: no es legal en Ecuador** (Defensoría del Pueblo, vía Vistazo 2022). La comisión
  la absorbe el comercio. Por eso el Smart Menu la tiene que mostrar: no se traslada al precio por medio de pago.
- **Obligación desde el 4 de septiembre de 2024** (Junta de Política y Regulación Monetaria): los negocios con RUC deben
  ofrecer al menos un medio de pago electrónico o billetera móvil. Casi todo comercio va a tener al menos uno además de
  efectivo.
- **Topes legales:** la Junta fija comisiones máximas a comercios por cobros con tarjeta (Resolución 514-2019-F y
  reformas). No se encontró el anexo vigente con los montos: los % de arriba son referencias de prensa y tarifarios
  viejos, no topes verificados.

## Contradicciones y lo no verificado

- **DeUna:** el centro de soporte para empresas dice 2 % por transacción; las páginas para emprendimientos y una guía
  de terceros dicen que el cobro presencial con QR es gratis. Hipótesis no confirmada: 0 % para el QR de persona
  natural o emprendimiento, 2 % para empresas o cobros digitales. **Por eso la forma es `percent`** (el comercio que no
  paga carga 0). Confirmar con un comercio que cobre con DeUna.
- **Tasas de tarjeta:** 2 % débito (El Comercio 2017; Defensoría vía Vistazo 2022), 4 % / 4,02 % crédito (Vistazo
  2022; tarifario Produbanco enero 2022, texto mal extraído; un blog de 2026 lo atribuye a la Superintendencia de
  Bancos). Todas son de 2017 a 2022; no se verificó la tasa vigente.
- **Cuotas de mercado** (débito ~40 %, crédito ~28 %, transferencia ~17 %, billeteras ~11 % de los pagos online):
  aparecen con el mismo texto en blogs comerciales, sin fuente primaria. No usar.
- **Medianet** y **Peigo**: sin tarifa pública encontrada.
- No investigado: Kushki, Pagomedios y otras pasarelas online (son para venta web, no para el POS); cooperativas
  (Jep Móvil y similares); el sistema de pagos inmediatos (SPI) previsto para 2026.

## Fuentes

- DeUna, soporte: [¿Deuna cobra comisión a tu empresa por cada transacción?](https://soporte.deunaapp.com/hc/es-419/articles/35385565764500--Deuna-cobra-comisi%C3%B3n-a-tu-empresa-por-cada-transacci%C3%B3n) · [Deuna Negocios, lanzamiento (KCH)](https://kchcomunicacion.com/?p=373936) · [Cobra con Deuna (Banco Pichincha)](https://www.pichincha.com/detalle-producto/pymes-servicios-deuna) · [Deuna para negocios 2026 (nmtechstudio)](https://www.nmtechstudio.com/blog/deuna-para-negocios-cobrar-qr-web-ecuador-2026)
- Payphone: [Cobertura y precios (Jelou docs)](https://docs.jelou.ai/en/guides/integraciones/pagos/proveedores/payphone/cobertura-y-precios) · [Pasarelas de pago Ecuador 2026 (nmtechstudio)](https://www.nmtechstudio.com/blog/pasarelas-pago-ecuador-2026-comparativa) · [Payphone 3.0 (CCQ)](https://ccq.ec/payphone-se-actualiza-a-la-version-3-0-e-incorpora-nuevas-funcionalidades)
- Tarjetas y Datafast: [Locales deben aceptar todas las tarjetas (El Comercio)](https://www.elcomercio.com/actualidad/negocios/locales-tarjetas-credito-debito-comercio.html) · [No es legal cobrar recargos (Vistazo)](https://www.vistazo.com/actualidad/nacional/no-es-legal-cobrar-recargos-en-pagos-con-tarjetas-de-credito-o-debito-donde-denunciar-el-cobro-LA1552782) · [Tarifario Produbanco enero 2022](https://www.produbanco.com.ec/media/708164/tarifario-tc-y-tarifas-enero-2022.pdf) · [Contrato de afiliación (Banco del Pacífico)](https://www.bancodelpacifico.com/BancoPacifico/media/PacifiCard/Establecimientos/AfiliacionComerciosPDF/2-Contrato-de-Afiliacion.pdf) · [Dudas sobre pagos con débito (El Universo 2019)](https://www.eluniverso.com/larevista/2019/12/08/nota/7637567/dudas-pagos-tarjetas-debito) · [Medios de pago en línea Ecuador (OlaClick)](https://olaclick.com/es/pos/medios-pago-en-linea-ecuador/)
- Regulación y contexto: [Medio de pago electrónico obligatorio (Primicias)](https://www.primicias.ec/economia/negocios-ecuador-medio-pago-electronico-billetera-movil-78768) · [Billeteras digitales en Ecuador (Primicias)](https://primicias.ec/economia/billeteras-digitales-ecuador-google-apple-pay-deuna-85103) · [Billeteras virtuales, Peigo (Vistazo)](https://www.vistazo.com/amp/hogar/entretenimiento/sacale-el-jugo-a-tu-billetera-virtual-KF7447048) · [JPRMF reforma cargos máximos (NMS Law)](https://nmslaw.com.ec/?p=12223)
