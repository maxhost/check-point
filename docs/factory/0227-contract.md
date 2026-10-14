# Contrato congelado 0227

Base a8868409. Writer A: esquema/core/Stock. Writer B: POS/Recetas/UI. Sin operaciones PROD.

- Core `server/module-events/index.ts`: `publishSaleClosed(tx, {businessId, sourceOrderId, locationId, closedAt: Date, userId, lines: {sourceLineId,productId: string|null,quantity:number}[]})`. Retorno `{eventId,closedAt:Date}|null`; POS usa `closedAt` capturado en la fila de cierre. Persistencia en tx del cierre; flag `MODULE_EVENTS_ENABLED === "true"`, OFF por defecto; no handlers dentro del cierre.
- Payload `SaleClosedEvent`: `eventVersion:1`, `sourceOrderId`, `locationId`, `closedAt:string`, `userId`, `lines` con `resourceVersions:{providerId,slot,versionId}[]`. Captura de punteros/activaciones en una sentencia; idempotencia fuente+tipo+comercio.
- `setResourceVersion(tx,{businessId,resourceType:"product",resourceId,providerId,slot,versionId})` para el mismo commit que guarda receta/revisión.
- `ModuleServer.eventSubscriptions?: {eventType:"sale.closed",resourceType:"product",slot:string,requiredModules:readonly string[],handler:(tx,event:{id,businessId,payload:SaleClosedEvent})=>Promise<void>}[]`. B exporta `eventSubscriptions` desde recipes/server/routes.ts. A conectará registro al terminar B; core accede al registro genérico, nunca importa módulos concretos.
- `retryModuleEvents({businessId?,locationId?,eventIds?:string[],budgetMs?,batchSize?,force?:boolean})` retorna `{claimed,applied,pending,failed}`. Handler ejecutado en tx propia con claim delivery bloqueado; estado aplicado en ese commit.
- DB exporta `recipeRevisions`: `{id,businessId,productId:string (sin FK a producto),lines:{itemId:string,unit:string,quantity:string}[],createdAt}`. `moduleResourceVersions`, `moduleEvents`, `moduleEventDeliveries`, `stockItemLocations`. Revisiones append-only. B prepara revisión en guardado/borrado y upsert puntero `providerId:"recipes",slot:"recipe"`.
- Stock `applyConsumption(tx,{businessId,locationId,sourceOrderId,closedAt:Date,userId,lines:{sourceLineId,productId:string, itemId,quantity:string}[]})`: cantidades ya multiplicadas por unidades vendidas, positivas; inserta negativos; lock pares ordenado/unicidad; ninguna división rendimiento.
- Stock `local.ts`: `listLocations(businessId)` devuelve `{locations:[{id,name,status}],defaultLocationId}`; `resolveLocation(businessId,rawLocationId?,{purchase?:boolean}?)`. Permiso de módulo mediante dispatcher.
- Lecturas Stock conservan arrays `items`/`movements` y agregan envelope `{locationId,pending:{count,failed}}`; DTO Item agrega `locationId:string|null`; DTO movement agrega `locationId,sourceOrderId,sourceLineId,productId` y kind `consumption`. query/body locationId; global create/update aceptan local para DTO.

Rollout expand 0082 con puente; herramientas preflight/backfill/contract/activate conservan datos. Contract se ejecuta después de validar writers y no es automática en PROD. Pruebas DB exclusivamente wrapper CI reservado.
