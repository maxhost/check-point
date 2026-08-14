# INDEX

Mapa de ADRs y specs. **Empeza aca.** Cada fila tiene lo suficiente para decidir si
abrir el archivo o no — no leas todo: lee la fila y abri lo que corresponda.

**Al crear un ADR o una spec, agregar la fila aca en el mismo commit.** Un indice
desactualizado es peor que no tenerlo.

## Arquitectura

[ARCHITECTURE.md](ARCHITECTURE.md) reúne las decisiones transversales y enlaza sus ADRs.
[SCAFFOLD-PLAN.md](SCAFFOLD-PLAN.md) define el recorrido y DoD para preparar el repositorio antes de implementar una feature.
[REPOSITORY.md](REPOSITORY.md) identifica el remoto canónico y la política de publicación.

## ADR — decisiones

| # | Fecha | Decision | Estado | Archivos |
|---|---|---|---|---|
| 0001 | 2026-08-09 | V1 centrada en campañas rentables para bares | aceptada | `adr/0001-v1-campanas-rentables-para-bares.md` |
| 0002 | 2026-08-09 | Guardrail económico y saldos aislados por local | aceptada | `adr/0002-guardrail-economico-y-no-puntos-globales.md` |
| 0003 | 2026-08-09 | V1 con consumidor, comercio y red curada por administrador | aceptada | `adr/0003-v1-tres-actores-y-red-curada.md` |
| 0004 | 2026-08-09 | Wallet con activos separados por emisor y alcance | aceptada | `adr/0004-wallet-con-emisor-y-alcance-explicitos.md` |
| 0005 | 2026-08-10 | Vigencia por emisor y ciclo de eliminación guest | aceptada | `adr/0005-vigencia-de-activos-y-retencion-guest.md` |
| 0006 | 2026-08-10 | Programa y campañas a nivel negocio; evento como campaña | aceptada | `adr/0006-programas-y-campanas-a-nivel-negocio.md` |
| 0007 | 2026-08-10 | Permisos globales, operación local y auditoría con snapshots | aceptada | `adr/0007-permisos-globales-operacion-local-y-snapshots.md` |
| 0008 | 2026-08-10 | Owner como único administrador de su merchant staff | aceptada | `adr/0008-owner-administra-exclusivamente-su-staff.md` |
| 0009 | 2026-08-10 | Cierre de local y elegibilidad dinámica de beneficios | aceptada | `adr/0009-cierre-de-local-y-elegibilidad-de-beneficios.md` |
| 0010 | 2026-08-10 | Dominios de acceso separados para consumidor, plataforma y comercio | aceptada | `adr/0010-dominios-de-acceso-separados.md` |
| 0011 | 2026-08-10 | Monorepo y despliegues web separados | propuesta | `adr/0011-monorepo-y-despliegues-web-separados.md` |
| 0012 | 2026-08-10 | Neon, Better Auth y esquemas de identidad separados | propuesta | `adr/0012-neon-better-auth-y-esquemas-de-identidad-separados.md` |
| 0013 | 2026-08-10 | OTP y tareas programadas con proveedores intercambiables | propuesta | `adr/0013-otp-y-tareas-programadas-con-proveedores-intercambiables.md` |
| 0014 | 2026-08-10 | QR, Wallet y check-in con defensa en capas | propuesta | `adr/0014-qr-wallet-y-checkin-con-defensa-en-capas.md` |
| 0015 | 2026-08-10 | Juegos web y AR como fase experimental | propuesta | `adr/0015-juegos-web-y-ar-como-fase-experimental.md` |
| 0016 | 2026-08-10 | Operación de merchant staff rápida y consistente | propuesta | `adr/0016-operacion-de-merchant-staff-rapida-y-consistente.md` |
| 0017 | 2026-08-10 | Estándar de entrega production grade | aceptada | `adr/0017-estandar-production-grade.md` |
| 0018 | 2026-08-10 | Incentive Engine de campañas compuestas | aceptada | `adr/0018-incentive-engine-de-campanas-compuestas.md` |
| 0019 | 2026-08-10 | Branding temático por negocio y primera experiencia consumer | aceptada | `adr/0019-branding-tematico-por-negocio.md` |
| 0020 | 2026-08-10 | Programa de fidelización único por negocio | aceptada | `adr/0020-programa-de-fidelizacion-unico-por-negocio.md` |
| 0021 | 2026-08-11 | Analíticas universales y lentes por rubro | aceptada | `adr/0021-analiticas-universales-y-lentes-por-rubro.md` |
| 0022 | 2026-08-11 | Objetivos de campaña y capacidades medibles | aceptada | `adr/0022-objetivos-de-campana-y-capacidades-medibles.md` |
| 0023 | 2026-08-11 | Disparadores independientes de objetivos de campaña | aceptada | `adr/0023-disparadores-independientes-de-objetivos.md` |
| 0024 | 2026-08-11 | Secretos en entorno y configuración no secreta | aceptada | `adr/0024-secretos-en-entorno-y-configuracion-no-secreta.md` |
| 0025 | 2026-08-11 | Búsqueda de locales con proveedores y procedencia | aceptada | `adr/0025-busqueda-de-locales-con-proveedores-y-procedencia.md` |
| 0026 | 2026-08-12 | Versiones, transiciones y términos de programas | aceptada | `adr/0026-versiones-transiciones-y-terminos-de-programas.md` |
| 0027 | 2026-08-12 | Programa mutable con cierre fechado | aceptada; supersede 0026 | `adr/0027-programa-mutable-con-cierre-fechado.md` |
| 0028 | 2026-08-12 | Auditoría y cancelación de cierre de fidelización | aceptada | `adr/0028-auditoria-y-cancelacion-de-cierre-de-fidelizacion.md` |
| 0029 | 2026-08-13 | Módulo de assets compartido para imágenes en R2 | aceptada | `adr/0029-modulo-de-assets-compartido-para-imagenes-en-r2.md` |
| 0030 | 2026-08-13 | Modelo de datos del diseño de tarjeta de fidelización | aceptada | `adr/0030-modelo-de-datos-del-diseno-de-tarjeta-de-fidelizacion.md` |

## Specs — que se construye

| # | Fecha | Spec | Estado | Disjunta? | Archivos |
|---|---|---|---|---|---|
| 0001 | 2026-08-09 | Acceso de backoffice, membresías y auditoría | borrador | no | `specs/0001-fundacion-identidad-y-roles.md` |
| 0002 | 2026-08-09 | Local, personal y catálogo económico | borrador | no | `specs/0002-local-personal-y-catalogo.md` |
| 0003 | 2026-08-10 | Wizard de campañas e Incentive Engine | borrador | no | `specs/0003-wizard-de-campana-y-guardrails.md` |
| 0004 | 2026-08-09 | Cuenta de consumidor, OTP y wallet | borrador | no | `specs/0004-consumidor-checkin-y-wallet.md` |
| 0005 | 2026-08-09 | Consola de personal y compra acreditada | borrador | no | `specs/0005-consola-de-personal-y-compra-acreditada.md` |
| 0006 | 2026-08-09 | Ruleta, cupones y canje atómico | borrador | no | `specs/0006-ruleta-cupones-y-canje-atomico.md` |
| 0007 | 2026-08-09 | Tablero y medición del piloto | borrador | no | `specs/0007-tablero-y-medicion-del-piloto.md` |
| 0008 | 2026-08-09 | Administrador, rutas, categorías y eventos | borrador | no | `specs/0008-administrador-rutas-y-eventos.md` |
| 0009 | 2026-08-09 | Check-in QR por local | borrador | no | `specs/0009-checkin-qr-por-local.md` |
| 0010 | 2026-08-10 | Scaffold production grade de la plataforma | cerrada | no | `specs/0010-scaffold-production-grade.md` |
| 0011 | 2026-08-10 | Prototipo QA de check-in consumer v0.1 | cerrada | no | `specs/0011-prototipo-qa-checkin-consumer.md` |
| 0012 | 2026-08-10 | Onboarding demo de owner, negocio y sucursales | cerrada | no | `specs/0012-onboarding-owner-y-negocio-demo.md` |
| 0013 | 2026-08-10 | Home demo del Backoffice owner | cerrada | no | `specs/0013-home-backoffice-owner-demo.md` |
| 0014 | 2026-08-10 | Marca de negocio demo | cerrada | no | `specs/0014-marca-negocio-demo.md` |
| 0015 | 2026-08-10 | Locales del owner demo | cerrada | no | `specs/0015-locales-owner-demo.md` |
| 0016 | 2026-08-10 | Staff del owner demo | cerrada | no | `specs/0016-staff-owner-demo.md` |
| 0017 | 2026-08-10 | Campañas del owner demo | cerrada | no | `specs/0017-campanas-owner-demo.md` |
| 0018 | 2026-08-10 | Fundación UI production-grade de merchant demo | cerrada | no | `specs/0018-fundacion-ui-merchant-demo.md` |
| 0019 | 2026-08-10 | Programa de fidelización del owner demo | cerrada | no | `specs/0019-programa-fidelizacion-owner-demo.md` |
| 0020 | 2026-08-11 | Analíticas owner demo multirubro | cerrada | no | `specs/0020-analiticas-owner-demo-multirubro.md` |
| 0021 | 2026-08-11 | Catálogo único de beneficios | borrador | no | `specs/0021-catalogo-unico-de-beneficios.md` |
| 0022 | 2026-08-11 | Registro, auth, suscripción y negocio inicial de Owner | cerrada | no | `specs/0022-registro-auth-owner-suscripcion-y-negocio.md` |
| 0023 | 2026-08-11 | Búsqueda y procedencia de locales | en revisión | no | `specs/0023-busqueda-y-procedencia-de-locales.md` |
| 0024 | 2026-08-12 | Programa de fidelización real y términos | implementada | no | `specs/0024-programa-fidelizacion-real-y-terminos.md` |
| 0025 | 2026-08-12 | Marca real del negocio y assets R2 | implementada | no | `specs/0025-marca-real-y-assets-r2.md` |
| 0026 | 2026-08-13 | Diseño de sello del programa de fidelización en R2 | implementada | no | `specs/0026-diseno-de-sello-en-r2.md` |
| 0027 | 2026-08-13 | Wizard de creación y diseño visual de la tarjeta de fidelización | implementada | sí | `specs/0027-wizard-y-diseno-de-tarjeta-de-fidelizacion.md` |

**"Disjunta?"** = si el trabajo no comparte archivos con otra spec abierta. Es lo que
habilita paralelizar. Lo decide la spec, no el orquestador en runtime.

## Convenciones

- **ADR** = una decision y su motivo. Se escribe cuando la decision se toma, no despues.
  Inmutable: si cambia, se escribe uno nuevo que supersede al viejo.
- **Spec** = que se va a construir, cerrada **antes** de tocar codigo. Ver
  `specs/TEMPLATE.md`.
- Numeracion correlativa de 4 digitos. No se reusan numeros.
- Frontmatter obligatorio con `fecha` y `resumen` de una linea: es lo que se lee sin
  abrir el archivo.

## Proceso con agentes

El protocolo obligatorio de orquestación, implementación, handoff y revisión independiente
está en [AGENT-WORKFLOW.md](AGENT-WORKFLOW.md). La plantilla de spec exige especificación
técnica, Definition of Done y plan de pruebas antes de que su estado pase a `cerrada`.
