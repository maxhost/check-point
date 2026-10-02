# Apple Wallet: actualizar el diseño de pases ya instalados

Investigación y procedimiento para CheckPass Club, 2026-10-02. Complementa las
[reglas de diseño](apple-wallet-design-rules.md) y la
[spec 0123](../specs/0123-pase-apple-wallet-trama-viva.md). **Un `git push` o un
deploy no modifica por sí solo los bytes que un iPhone ya guardó.** Los pases nuevos
usan el constructor desplegado; los viejos necesitan que Wallet descargue un
`.pkpass` nuevo.

## Contrato de Apple

1. El pase instala `webServiceURL` y `authenticationToken`; el dispositivo registra
   su `deviceLibraryIdentifier` y `pushToken` en el servicio del emisor.
2. Al cambiar el pase, el servidor envía a cada dispositivo registrado un aviso
   APNs con `{}`. El aviso no lleva el arte: despierta la consulta. Apple indica
   que el push de actualización funciona en el entorno APNs de **producción**.
3. Wallet llama al endpoint de seriales con `passesUpdatedSince`. Si el pase cambió,
   el servicio devuelve `serialNumbers` y un `lastUpdated` mayor que el tag previo.
4. Wallet pide el pase concreto con `Authorization: ApplePass <authenticationToken>`.
   El servidor entrega `application/vnd.apple.pkpass`, recién firmado, con el mismo
   Pass Type ID y serial. Apple prohíbe cambiar serial y `authenticationToken` en
   una actualización. Wallet sustituye el pase local.

El aviso APNs es una señal, no una confirmación de que el iPhone descargó y mostró
el pase. Puede retrasarse o no entregarse; Apple también puede agrupar avisos.
Registrar envío, consulta y resultado en el dispositivo antes de declarar una
campaña completa. [Apple: servicio de actualización](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes),
[lista de seriales](https://developer.apple.com/documentation/walletpasses/get-the-list-of-updatable-passes),
[entrega del pase](https://developer.apple.com/documentation/walletpasses/send-an-updated-pass),
[distribución y reemplazo](https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass).

## Cómo está conectado en este repo

| Paso | Implementación actual | Comprobación |
|---|---|---|
| Emisión y respuesta | `packages/domain/src/server/wallet/apple.ts` crea el mismo tipo de pase firmado; `apps/consumer/src/app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts` lo sirve. | Nuevo paquete incluye PNG actualizados y conserva serial, token y QR. |
| Registro | Ruta `apps/consumer/src/app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route.ts`; tabla `consumer.wallet_push_device`. | Existe registro para el pase de QA; no mostrar push tokens en capturas. |
| Versión | `PASS_BRAND_UPDATED_AT` en `pass-version.ts` participa en la lista de seriales y `Last-Modified` del `.pkpass`. | La nueva revisión debe superar el tag de marca anterior; pase viejo recibe `200`, no `304`. |
| Aviso | `consumer.wallet_push_queue` con `class='pass_refresh'`; worker `apps/merchant/src/server/wallet/push.ts` y `push-transports.ts` envía APNs vacío. | Fila `sent` **sin** `last_error`, llamada PassKit posterior y observación del iPhone. |
| APNs | `apps/merchant/src/server/wallet/apns.ts` usa HTTP/2 y `apns-topic = APPLE_PASS_TYPE_ID`. | Confirmar credenciales y entorno APNs en producción antes de encolar. |

**Límite operativo encontrado:** `RealPushChannel.sendApple()` retorna sin error si
faltan `APPLE_APNS_KEY_ID`, `APPLE_APNS_KEY_P8` o `APPLE_APNS_TEAM_ID`/`APPLE_TEAM_ID`.
El worker puede marcar la fila `sent` aunque no avisó a ningún dispositivo. La
configuración APNs no está acreditada por las pruebas locales ni por un `push` a
GitHub. Antes de cualquier lote, comprobar las tres variables en el proyecto que
ejecuta **el worker del comercio** y hacer un envío de QA observado en iPhone.
No copiar los valores de los secretos a logs o documentación. Apple describe el
uso del certificado de pase para notificaciones; este repo usa una clave APNs `.p8`.
Verificar en QA que Apple acepta el `apns-topic` del Pass Type ID antes del lote.
[Apple: APNs con token](https://developer.apple.com/documentation/UserNotifications/establishing-a-token-based-connection-to-apns).

**Pases históricos con solo hash:** algunas filas antiguas tienen
`consumer.wallet_pass.auth_token IS NULL` y conservan únicamente
`auth_token_hash`. El servidor puede reconocer el token del pase instalado por
comparación de hash, pero no puede reconstruirlo para incluir el **mismo** token en
el paquete actualizado. El fallback actual crea un token nuevo al servirlo, que
contradice la regla de Apple de conservar `authenticationToken`. **Excluir esas filas
del lote automático**; medirlas y planificar redistribución individual o una
corrección específica. No afirmar que el flujo silencioso las migrará.

## Publicar una revisión de diseño

### 1. Preparar el paquete

1. Aprobar arte y límites según las [reglas de diseño](apple-wallet-design-rules.md).
2. Cambiar las fuentes versionadas, ejecutar el generador de arte, verificar PNG y
   pruebas del paquete. Incrementar `PASS_BRAND_UPDATED_AT` a una fecha UTC
   posterior a la anterior. Esa constante permite que un pase **sin novedad nueva**
   figure como actualizado.
3. Conservar `passTypeIdentifier`, `serialNumber`, `authenticationToken`, QR y firma
   válida. Si cambia el Team ID o Pass Type ID por traslado de cuenta, los pases
   viejos no se migran con este flujo: necesita un plan de reemplazo propio.
4. Antes del QA, contar pases Apple con dispositivo registrado y
   `auth_token IS NULL`. Si el pase de QA cae en ese grupo, elegir otro con token
   estable para validar el flujo normal y tratar el histórico por separado.

### 2. Verificar el despliegue y un pase nuevo

1. Desplegar el **consumidor** que emite y sirve pases antes de avisar a los viejos.
   Confirmar que el despliegue está listo; un commit en `main` no es esa evidencia.
2. Guardar un pase nuevo de QA y verificar el arte, el QR y «Ver mis programas» en
   iPhone. Probar nombre largo y la versión de iOS objetivo. Confirmar si Wallet
   muestra `strip`; las guías de Apple discrepan en iOS reciente.
3. Revisar también el **comercio**, que ejecuta el worker APNs. Debe tener
   `APPLE_PASS_TYPE_ID`, credenciales APNs válidas y el host de producción; la
   prueba local usa un canal falso y no demuestra entrega real.

### 3. Refrescar primero un pase anterior de QA

Identificar **internamente** el `consumer_id` de un pase Apple instalado *antes*
del despliegue; confirmar que existe al menos un registro de dispositivo:

```sql
select count(*) as dispositivos
from consumer.wallet_pass p
join consumer.wallet_push_device d on d.wallet_pass_id = p.id
where p.provider = 'apple'
  and p.auth_token is not null
  and p.consumer_id = '<consumer_uuid>'::uuid;
```

Encolar **una** actualización silenciosa para ese miembro después de confirmar el
deploy. La operación siguiente no crea una fila adicional si ya hay un refresco
`pending` o `sending`; en ese caso el worker existente entregará el arte actual:

```sql
insert into consumer.wallet_push_queue (consumer_id, class, title, body)
select p.consumer_id, 'pass_refresh', '', ''
from consumer.wallet_pass p
where p.provider = 'apple'
  and p.consumer_id = '<consumer_uuid>'::uuid
  and p.auth_token is not null
  and exists (
    select 1 from consumer.wallet_push_device d where d.wallet_pass_id = p.id
  )
  and not exists (
    select 1 from consumer.wallet_push_queue q
    where q.consumer_id = p.consumer_id and q.class = 'pass_refresh'
      and q.status in ('pending', 'sending')
  )
returning id;
```

El worker cron `GET /api/internal/wallet-push` del **comercio** procesa la cola
con `CRON_SECRET`; no invocar ni publicar ese secreto desde el navegador.
Comprobar la fila por su `id`: `status='sent'` con `last_error IS NULL` solo acredita
que el worker no registró error. Revisar logs del consumidor para la consulta de
seriales y la descarga `200` del pase. Finalmente mirar el pase **sin borrarlo ni
volverlo a agregar** en el iPhone. Verificar arte, nombre, QR escaneable, serial y
enlace. Si no hubo registro, push, consulta o descarga, ese paso no está validado.

### 4. Comunidad: lote único tras el QA

Contar candidatos con dispositivo registrado y sin refresco pendiente. Guardar el
resultado y la revisión de arte en el registro operativo antes de encolar:

```sql
select count(distinct p.consumer_id) as candidatos
from consumer.wallet_pass p
join consumer.wallet_push_device d on d.wallet_pass_id = p.id
where p.provider = 'apple'
  and p.auth_token is not null
  and not exists (
    select 1 from consumer.wallet_push_queue q
    where q.consumer_id = p.consumer_id and q.class = 'pass_refresh'
      and q.status in ('pending', 'sending')
  );
```

Contar aparte los pases históricos con dispositivo registrado y sin token
recuperable; no entran en el lote:

```sql
select count(distinct p.consumer_id) as historicos_solo_hash
from consumer.wallet_pass p
join consumer.wallet_push_device d on d.wallet_pass_id = p.id
where p.provider = 'apple' and p.auth_token is null;
```

Tras observar el pase viejo de QA, encolar una sola vez para la revisión aprobada:

```sql
insert into consumer.wallet_push_queue (consumer_id, class, title, body)
select distinct p.consumer_id, 'pass_refresh', '', ''
from consumer.wallet_pass p
join consumer.wallet_push_device d on d.wallet_pass_id = p.id
where p.provider = 'apple'
  and p.auth_token is not null
  and p.consumer_id <> '<consumer_uuid_de_qa>'::uuid
  and not exists (
    select 1 from consumer.wallet_push_queue q
    where q.consumer_id = p.consumer_id and q.class = 'pass_refresh'
      and q.status in ('pending', 'sending')
  )
returning id;
```

Registrar los IDs devueltos en una ubicación operativa protegida, contar `sent`,
`failed` y `last_error`, y comprobar una muestra de dispositivos. **La consulta
no lleva un marcador persistente de revisión:** si se ejecuta de nuevo después
de que el worker cierre las filas, puede enviar duplicados. Ejecutarla una vez
por revisión y no interpretar `sent` como confirmación visual en el iPhone. La
clase `pass_refresh` también hace un `PATCH` silencioso del pase Google del mismo
miembro, si existe; no agrega un mensaje visible.

Los pases instalados **sin registro** de dispositivo y los históricos **solo hash**
no entran en este procedimiento automático. Para ellos, ofrecer al miembro
descargar otra vez el `.pkpass`
con el mismo Pass Type ID y serial; Apple indica que reemplaza el existente. Si
la autenticación histórica no coincide, investigar ese pase antes de depender
del web service. [Apple: reemplazar un pase](https://developer.apple.com/documentation/walletpasses/building-a-pass),
[Apple: token estable](https://developer.apple.com/documentation/passkit/pkpass/authenticationtoken).

## Diagnóstico y reversión

| Síntoma | Qué revisar |
|---|---|
| Pase nuevo muestra el estilo viejo | Deploy del consumidor, versión del bundle, paquete descargado y caché de la ruta emisora. |
| Fila `sent`, iPhone viejo sin cambio | ¿Credenciales APNs presentes? ¿Hay dispositivo registrado? ¿`last_error`? ¿Llegó la consulta de seriales y el GET del pase? APNs aceptado no garantiza entrega. |
| Lista de seriales devuelve `204` | `PASS_BRAND_UPDATED_AT` y `passesUpdatedSince`; la revisión nueva debe superar el tag anterior. |
| GET del pase devuelve `304` | `Last-Modified` y `If-Modified-Since`; revisar fecha de marca y contenido. |
| GET devuelve `401` | Token de autenticación del pase instalado vs base; no rotarlo al actualizar. Revisar si es una fila histórica solo hash. |
| APNs `410` | Token del dispositivo inválido; el worker elimina el registro. |
| Arte no aparece aunque el GET fue `200` | Validar firma, manifiesto, imágenes, compatibilidad de iOS y render real de `strip`. |

Para revertir, restaurar el constructor/arte anterior, establecer una **nueva**
fecha de marca posterior a la revisión fallida, desplegar y repetir el piloto APNs
antes de un lote. Una fecha antigua podría hacer que Wallet considere vigente el
pase que se quería retirar. No cambiar serial, token ni QR para revertir diseño.
