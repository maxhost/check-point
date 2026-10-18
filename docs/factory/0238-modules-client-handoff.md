# 0238 — módulos cliente: snapshot e intención PUT

Base asignada `6173451c`, task backoffice-0238-server, recurso harness:0238-client-modules. Solo seis paths reservados de settings y este handoff. Provider/controller/request-owner son propiedad exclusiva de B y NO se editan aquí. Artefactos propios: `/private/tmp/checkpass-0238/client-modules/`. Sin app, browser, DB, push ni PROD.

## Comportamiento

ModuleConfiguration usa core del provider y conserva el filtro de propietario; elimina el GET de sesión paralelo. ModuleSettings/useBusinessModules consumen exclusivamente snapshot.modules y eliminan listas, GETs y listeners locales. Loading/ready/restricted/unavailable permanecen distintos: la lista solo aparece en ready. Reintentar lectura llama revalidateModules del owner, sin nuevo transporte ni store. StaffConsole conserva el contrato previo del hook, con la misma lista/estado/error/reload; no se cambia ese caller fuera del alcance.

El formulario mantiene kit, autorización visual, lock, busy, dependencia, bloqueo openCount y sus copias. ModuleRequestError nativo conserva código/campos para los errores existentes. No hay router.refresh ni señales ad hoc tras confirmar el PUT: actualiza únicamente el snapshot mediante API específica. La actualización causal de otros RSC/panels que antes dependían del refresh global queda para la pieza coordinada posterior; no se declara resuelta aquí.

captureModuleToggleIntent copia scope/epoch e id/estado objetivo por valor al click. Invalida modules/inbox/checklist sincrónicamente y captura el ticket de generación nueva antes del await PUT; verifica misma identidad entre ambas capturas. Usa moduleRequest existente con scopeKey capturado, sin volver a leer/retag tras await. Cada intención se consume una vez; retry requiere otro click/intención.

Respuesta vigente usa applyConfirmedModule(ticket,DTO), que B implementa sobre base ready actual con validación completa/ticket y nueva invalidación antes del merge. Se comprueba id/estado objetivo de la respuesta para no confirmar otro cambio. Si se pierde generación dentro de la misma identidad, no se aplica DTO/error viejo y se pide revalidateModules, sin repetir PUT. Si cambia identidad/época, éxito/error/409 viejos se descartan sin tocar otro ámbito. Solo backoffice_context_changed vigente llama retire una vez; otros409/dependencias/openCount y errores operativos conservan formulario/error, sin navegación. DTO inválido o confirmación rechazada pide recuperación y mantiene error de confirmación, sin fabricar éxito.

publishModules publica únicamente Event, sin detail: ningún array externo puede establecer estado de navegación. El provider continúa siendo el único owner de señales/transportes/aceptación. La pieza no importa ni duplica controller ni request owner.

## Dependencia pública acordada con B

```ts
applyConfirmedModule(ticket: BackofficeResourceTicket, module: ModuleDTO): boolean;
revalidateModules(): void;
```

B confirmó firmas y responsabilidad de invalidar modules/inbox/checklist ANTES de aplicar DTO, validar ticket completo/resource/shape/id/base actual y rechazar respuestas viejas. revalidateModules invalida y usa su cola existente, sin reporter automático. No se añaden casts/defaults temporales en los consumers. Estas APIs todavía NO están en la base617 de esta pieza; TSC final de combinación requiere integración coordinada de su checkpoint.

## Evidencia y límites

- Helper22 + transporte S1 existente5: **27/27 PASS**, cero skips (`unit-final.log`; primer focal25/25 en unit-first.log, ampliado con error tardío y ticket mutable). Los tests simulan la invalidación interna de confirmación de B para comprobar que no se rechace como obsoleta la propia confirmación.
- Casos: retirada, captura antes PUT/invalidador sync, primitives clonados, scope/época nuevos, identidad retirada durante invalidación, generación perdida antes/durante vuelo, cambio de sesión con éxito/error/409 viejo, retiro único sin replay, errores nativos y retry explícito, respuesta inválida y raw signal sin payload. Transporte no se modifica; sus cinco tests de scope/copy/body/error siguen verdes.
- ESLint focal, Prettier, UI guard contra6173451c (cinco archivos, sin aumentos) y diff-check: EXIT0. Sin CSS, estilos, kit ni nueva autoridad por eventos.
- **TSC pendiente de dependencia externa:** types-pending-provider.log contiene exactamente TS2345 en module-settings (faltan applyConfirmedModule/revalidateModules del contexto) y TS2339 en use-business-modules (falta revalidateModules). Ningún otro error. No se afirma PASS ni se oculta mediante casts/compatibilidad. B reporta esas APIs escritas y testeadas en su WT, todavía sin entrega integrada al preparar esta pieza.
- El primer formateo detectó un resto mecánico del useEffect eliminado en module-configuration; corregido antes de pruebas. No se eliminan aserciones ni se cambia un test para esconder fallos.
- Skill Impeccable ya leída en el mismo worker: aplicación mínima de harden/performance a estados, permisos e intenciones; no se rediseña ni se repite carga de contexto. Browser/React real y coordinación UI↔provider/owner requieren QA de combinación; estos units no demuestran por sí solos montaje sin GET ni render del formulario con proveedor real.

Fuente preparada para commit local limpio; aceptación y TSC final esperan las APIs de B por coordinación. No factorydeliver ni cambios de refs ajenos desde worker.
