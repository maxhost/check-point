---
spec: 0021
fecha: 2026-08-11
estado: borrador
resumen: El negocio administra un catálogo único de beneficios reutilizables; campañas, juegos y canjes definen de forma independiente cómo y cuándo se distribuyen.
disjunta: no
archivos: apps/merchant, packages/contracts, packages/domain, packages/db, pruebas y docs
---

# 0021 — Catálogo único de beneficios

## Problema

Un negocio no debe volver a redactar y configurar “2x1 en cerveza” cada vez que crea una
campaña, una ruleta o un canje. Separar cupones y premios duplicaría el mismo contenido:
un beneficio puede entregarse como cupón, premio de juego, recompensa por check-in o
canje por puntos/sellos.

La definición del beneficio tampoco puede contener reglas de una campaña. Su vigencia,
límite, audiencia, activación, locales y modalidad de distribución cambian según el uso.

## Alcance

**Entra:**

- Un **Catálogo de beneficios** único por negocio con crear, editar, archivar y consultar
  beneficios reutilizables.
- Definición del beneficio: nombre, texto visible para consumidor, valor/coste estimado,
  imagen opcional y estado `draft`, `active` o `archived`.
- Selección de un beneficio activo en campañas, pools de juegos y configuraciones de
  canje del programa de fidelización.
- Una campaña define por cada beneficio seleccionado: mecánica/distribución, activación,
  condiciones, vigencia desde la emisión, límites, calendario, locales y audiencia.
- Instancias emitidas con snapshot del beneficio y de las reglas de distribución que las
  originaron, para preservar la auditoría e historia.
- En el demo merchant, una pantalla propia de catálogo con fixtures y selección en el
  wizard de campañas cuando el incentivo sea un beneficio.

**No entra:**

- Inventario, stock, proveedor, variantes, impuestos, ecommerce o integración POS.
- Reglas de canje dentro de la definición del beneficio.
- Crear automáticamente un beneficio mientras se publica una campaña; el owner sale al
  catálogo y vuelve a seleccionarlo.
- Puntos y sellos como entradas del catálogo: son efectos nativos del programa de
  fidelización, aunque pueden coexistir en una campaña o pool de juego.
- Raspadita, ruleta o canje real; esta spec deja preparada la referencia al beneficio,
  no implementa esos motores.

## Diseño

El catálogo contiene el **qué**. La campaña, juego o canje contiene el **por qué, cuándo,
para quién y cómo**.

```text
Beneficio: “2x1 en cerveza”
  texto: “Con la compra de una cerveza, llevas otra de regalo”
  coste estimado: $2,50

Campaña: “Visita de bienvenida”
  activación: check-in válido
  distribución: cupón
  beneficio: “2x1 en cerveza”
  vigencia: 7 días desde la emisión
  límite: 1 por persona
```

El mismo beneficio puede ser usado por otra campaña con otra distribución y términos,
por ejemplo como ítem con probabilidad dentro de una ruleta válida sólo los viernes. Un
beneficio `archived` deja de poder asignarse a configuraciones nuevas; no modifica ni
invalida las instancias ya emitidas.

“Cupón” no es un tipo de beneficio del catálogo. Es una modalidad de distribución y una
instancia recibida por el consumidor, con emisor, destinatario, estado, vencimiento y
campaña de origen. La wallet muestra esa instancia, no una copia mutable del catálogo.

La pantalla de campañas no tendrá campos para inventar un cupón. Cuando el owner elige
una distribución que entrega un beneficio, selecciona uno activo del catálogo y luego
configura las reglas de esa campaña. Si aún no hay beneficios activos, ve un estado vacío
con acceso al catálogo.

## Especificación técnica

El modelo futuro separa tres capas:

```text
benefit_definition
  id, business_id, name, consumer_copy, estimated_cost, image, status, timestamps

campaign_benefit_distribution
  campaign_version_id, benefit_definition_id, delivery_mode,
  eligibility, issued_valid_for, limits, budget, priority

issued_benefit
  id, consumer_id, source_event_id, campaign_version_id,
  benefit_snapshot, distribution_snapshot, status, issued_at, expires_at, redeemed_at
```

- `delivery_mode` es cerrado y tipado: `coupon`, `immediate`, `game_prize` o
  `loyalty_redemption`. El motor sólo admite modos implementados en esa versión.
- `benefit_definition` nunca contiene expiración, cupo, locales, requisito de compra,
  audiencia ni calendario.
- La creación de `issued_benefit` ocurre dentro de la transacción e idempotencia del
  Incentive Engine; no se emite desde el cliente.
- Editar el catálogo afecta usos futuros. Las instancias y las campañas publicadas
  conservan snapshots, incluida la copia que vio el consumidor y el coste estimado
  utilizado para el guardrail.
- Un beneficio de otro `business_id`, `draft` o `archived` no es asignable. Las reglas
  publicadas validan también que su snapshot sea completo.

Para el mock, el estado se agrega al fixture `merchant-demo` y se persiste como los demás
módulos. La UI reutiliza `ModuleHeader`, `ConfirmDialog`, toast y componentes de carga de
imagen existentes; no crea formularios ni modales duplicados.

## Arquitectura de referencia

- ADR 0002 — coste y guardrail económico por negocio.
- ADR 0004 — wallet con activos/instancias separados por emisor.
- ADR 0006 — programas y campañas a nivel de negocio.
- ADR 0018 — Incentive Engine, versiones, límites e idempotencia.
- ADR 0020 — puntos y sellos como modalidades del programa, no como catálogo.
- ADR 0022 y Spec 0003 — objetivo, mecánica, incentivo y métrica de campaña.
- Spec 0006 — canje atómico y juegos que consumirán instancias emitidas.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/demo/page.tsx` | añadir acceso al Catálogo de beneficios |
| `apps/merchant/src/app/backoffice/demo/benefits/page.tsx` | crear listado, estado vacío y editor mock |
| `apps/merchant/src/app/backoffice/demo/campaigns/new/page.tsx` | reemplazar creación ad-hoc por selección de beneficio |
| `apps/merchant/src/app/demo.ts` | añadir fixture y persistencia mock de beneficios |
| `apps/merchant/src/app/components/**`, `globals.css` | reutilizar componentes y añadir sólo estilos compartidos necesarios |
| `packages/contracts`, `packages/domain`, `packages/db` | implementar contrato, snapshots, validación y persistencia al construir backend |
| `apps/merchant/src/app/**/*.test.*`, `tests/e2e/**` | añadir cobertura de catálogo, selección y archivado |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | mantener seguimiento al implementar/verificar |

### Disjunta?

No. Comparte el wizard de campañas, el fixture merchant, home, componentes, el futuro
Incentive Engine, wallet y canje. Se implementa de forma serial antes de conectar campañas
a beneficios reales.

## Definition of Done

- [ ] Owner puede crear, editar y archivar un beneficio con nombre, texto de consumidor,
  coste/valor estimado e imagen opcional.
- [ ] Un beneficio no contiene condiciones, vigencia, límites, audiencia, locales ni
  calendario de campaña.
- [ ] Campañas, juegos y canjes pueden referenciar un beneficio activo del mismo negocio
  y definen sus propios términos de distribución.
- [ ] El wizard muestra estado vacío y acceso al catálogo si necesita un beneficio y no
  hay uno elegible; nunca crea un cupón ad-hoc dentro de la campaña.
- [ ] Una instancia emitida conserva snapshots del beneficio y de los términos de la
  campaña; editar o archivar el catálogo no altera la historia.
- [ ] Beneficios `draft` o `archived`, o de otro negocio, no son asignables.
- [ ] La UI es responsive/mobile-first, accesible, usa componentes reutilizables y
  muestra errores/toasts coherentes.
- [ ] Format, lint, typecheck, unit, E2E y build pasan; revisor independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: validar campos requeridos, transiciones de estado y aislamiento por
  `business_id`.
- [ ] Unidad: una distribución rechaza beneficio inexistente, no activo o de otro negocio.
- [ ] Integración: publicar/emitir genera snapshots inmutables; editar beneficio o reglas
  sólo afecta emisiones futuras.
- [ ] UI: crear, editar y archivar; estado vacío del catálogo desde el wizard y selección
  de un beneficio activo.
- [ ] E2E móvil: crear beneficio, asignarlo a campaña, revisar términos de campaña y
  comprobar que no se puede asignar tras archivarlo.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.

## Abierto

Se definirá antes de backend si valor y coste deben ser ambos obligatorios, cómo se modelan
beneficios sin coste financiero directo y qué campos de cumplimiento por rubro se requieren.
