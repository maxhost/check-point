---
adr: 0147
fecha: 2026-10-14
estado: propuesta
resumen: Separar identidad de Equipo y acceso opcional, versionar locales y ofrecer panel y callback genéricos sin datos monetarios en core.
---

# 0147 — Identidad y punto de enganche de módulos en Equipo

## Contexto

[SPEC0231](../specs/0231-costos-fijos-por-local-y-personal.md) incorpora decisiones del owner: personal en Equipo sin acceso/permisos, 1..N locales con vigencia mensual, sueldo total en su ficha visible con Rentabilidad y repartido exactamente por local. Reemplaza la recomendación inicial de líneas personales libres en módulo. Se autoriza especificar capacidad core, sin implementar ni diseñar UI aquí.

Alta actual crea usuario auth/email sintético/membresía/handle/PIN; CHECKs exigen permisos no vacíos y handle/PIN incluso desactivado. Identidad y acceso están unidos. No se resuelve relajando CHECKs o creando credenciales sin uso. Guards existentes exigen sesión/membresía activa y conservan sus invariantes.

Equipo es core, costos módulo; ADR0139 prohíbe imports/literales de módulos concretos en core. ADR0141 ofrece enganche por local pero no por integrante. Cambiar locales debe guardar reparto salarial en la misma transacción sin exponer importes al gestor que solo tiene `staff`; el bus `sale.closed` no resuelve este contrato y no se amplía aquí.

## Propuesta técnica

Propuesta técnica revisable junto con SPEC0231 mediante QA documental. El backend puede implementarse antes del cableado UI.

### Identidad y acceso opcional

Añadir `core.staff_person`: UUID estable por comercio, nombre y vínculo opcional a membresía staff del mismo comercio. Sin acceso inicial no hay usuario auth, membresía, handle o PIN. Grant crea/vincula acceso con los mecanismos vigentes; revocación desactiva membresía/sesiones y conserva identidad/sueldo. CHECKs de permisos/credenciales en membresía permanecen. Al retirar acceso los permisos almacenados pueden permanecer no vacíos, pero quedan sin efecto por estado `disabled`; acceso efectivo y permisos almacenados se distinguen explícitamente.

Backfill 1:1 de staff existente sin alterar credenciales/permisos ni inventar locales. Nuevas rutas `/api/staff/people` por `personId` incluyen personas sin usuario y exigen 1..N locales al crear. Compatibilidad transitoria: `POST /api/staff` legado mantiene `{name,permissions}` sin locales, crea persona vinculada con `locationsConfigured:false` y no admite sueldo hasta selección explícita, sin romper la UI existente. Rutas legadas por `userId` conservan contrato para acceso/permiso/PIN. Writers legados sincronizan identidad/vínculo, sin convertir `personId` en usuario. Grant reutiliza validación y protecciones actuales bajo `staff`, no agrega un camino de autenticación por persona. Campos, contratos y negativos concretos en SPEC0231.

### Asignación temporal y mantenimiento transaccional

Historia mensual core de conjuntos de locales por persona (`staff_location_period` + asignaciones), 1..N propios sin duplicados, con `[desde,hasta)`. Writer exige `staff`, revisión esperada y lock de persona; cambiar desde M conserva anteriores y siguiente frontera ya programada. Un legacy sin asignar conserva acceso, pero no admite sueldo hasta selección explícita. Locales no cambian permisos o lugar donde puede operar un login.

Añadir un callback opcional genérico a `ModuleServer`, implementado por los módulos que mantengan datos derivados de esa asignación:

```ts
staffLocationsChanged?: (
  tx: DbTransaction,
  change: {
    businessId: string;
    personId: string;
    fromMonth: string;
    untilMonth: string | null;
    locationIds: readonly string[];
  },
) => Promise<void>;
```

Core obtiene callbacks del registro y los invoca en la misma transacción que guarda asignación. Sin id/permiso de un módulo concreto ni import de su carpeta. Se ejecutan **también con módulo apagado** como mantenimiento interno de datos previos; no abre rutas, UI o permisos. Si el módulo no tiene datos afectados, no escribe. Error sanitizado revierte cambio core y derivado, sin revelar importes; no interviene en ventas.

En el módulo de costos el callback solo redivide salarios ya existentes: no crea sueldo ni cambia total/moneda/baja. Intersecta fronteras core con las variaciones salariales ya programadas; conserva tramo previo y totales futuros propios, sin aplanarlos al actual. Guarda periodos/asignaciones por local en la misma transacción. Todos los writers relevantes bloquean persona→costos en orden UUID; revisión core bajo lock y revisión monetaria actualizada si cambió distribución. Repetir mismo conjunto es idempotente. Lecturas puras sin materialización diferida, eventos asíncronos o cron.

Un gestor con `staff` puede cambiar locales sin leer/escribir total monetario: redistribuirlo es consecuencia automática explícita del cambio autorizada por el owner. API monetaria conserva su permiso; callback no es una API para el gestor ni devuelve dinero. Fallar la actualización revierte Equipo con error genérico, no una venta; el caller nunca recibe payload salarial.

### Acción y panel por persona

```ts
// ModuleManifest: declaración pura opcional.
staffAction?: { label: string; icon?: string; permission: string }

// ModuleScreens: aporte del módulo en el registro UI.
staffPanel?: ComponentType<{
  person: { id: string; name: string }
}>
```

`id` es `staff_person.id`, no `userId` ni login. Funciona con y sin acceso. El core pasa identidad mínima; nunca sueldo, moneda, credenciales o permisos del integrante. Panel vive en `modules/<id>/ui/`, consulta API propia y sus guards verifican permiso/activación/tenant independientemente de que el botón esté oculto.

Equipo obtiene acciones del registro solo con módulo encendido, permiso efectivo declarado y panel registrado. Owner tiene capacidad implícita; apagado oculta acción sin borrar datos. DTO de Equipo no incorpora dinero. Core no nombra módulos/permisos concretos; los registros siguen siendo la única puerta. Administración de identidad/acceso/locales conserva `staff`; permiso monetario no lo concede y API monetaria no exige además `staff`. Acceso visual con solo permiso monetario se resuelve después en el encargo UI, sin abrir administración core.

## Alternativas y consecuencias

- Relajar membresía o crear auth/PIN sin necesidad: mezcla identidad/acceso y debilita invariantes; persona core evita ambos problemas.
- Línea libre del módulo: recomendación sustituida por decisión owner de personal en Equipo.
- Sueldo en DTO core o llamado directo al módulo: acopla responsabilidades y expone datos; se propone contrato genérico y callback sin resultado monetario.
- Conciliación al leer o bus asíncrono: añade estado pendiente y riesgo de costos viejos; callback guarda asignación/reparto atómicamente, incluso apagado.

Implementación futura con reservas explícitas de contratos/core/esquema y backfill de identidad, además del módulo. La integración visual puede esperar con `{screens:{}}`; backend no depende de diseñar pantallas. No se crea enganche de Dashboard. Migración de identidad/asignaciones/costos se numera al implementar; nada se genera aquí.

## Verificación al implementar

Persona sin acceso sin auth/membership/PIN; grant/revocación con protecciones actuales y mismo `personId`; backfill sin alterar credenciales/permisos ni inventar locales. Core exige `staff`, módulo su permiso, DTOs core sin dinero. Callback incluso apagado guarda reparto en misma transacción, conserva total/meses previos/subidas futuras y falla sin datos sensibles; concurrencia con writers salariales usa persona→costos. Sin escrituras al leer. Acciones/panel solo con permiso/activación/aporte; tenant y revocación comprobados por servidor. Mantener negativos auth/membresía y fronteras modulares sin relajar guardias o tests.
