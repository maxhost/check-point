---
spec: 0004
fecha: 2026-08-09
estado: reencuadrada por ADR 0031
resumen: Crea cuentas guest y registradas por OTP, permite recuperación por email y muestra un wallet con activos de plataforma y comercios.
disjunta: no
archivos: depende de 0001, 0002 y 0009; rutas concretas se completan tras las decisiones de arquitectura
---

# 0004 — Cuenta de consumidor, OTP y wallet

> **Reencuadrada por el ADR 0031 (2026-08-14).** Esta spec se escribió bajo el
> posicionamiento viejo (descubridor "Foursquare × Niantic": wallet como cuenta general de
> descubrimiento, activos de plataforma, rutas/coleccionables, app consumer propia). El ADR
> 0031 movió el producto a **merchant-first** con la **Wallet nativa** como superficie. Su
> núcleo de identidad se rehace, acotado y alineado, en las specs **0028–0031**. Las partes
> de descubrimiento/rutas/activos de plataforma quedan **diferidas** a la fase futura del ADR
> 0031. No implementar esta spec tal cual: es material de referencia histórica.

## Problema

El primer contacto ocurre en el local y no debe exigir descargar una app ni completar un formulario. A la vez, los beneficios ganados no pueden perderse silenciosamente y el usuario debe entender qué pertenece a Mi Pasaporte y qué a cada comercio.

## Alcance

**Entra:**

- Creación automática de un pasaporte `guest` cuando una persona escanea un QR de check-in sin sesión.
- Wallet web usable como guest, con banner persistente que advierte que sus beneficios se perderán si borra/cambia de dispositivo antes de completar el registro.
- Registro e inicio de sesión sin contraseña: número de teléfono en formato E.164, OTP por SMS y sesión de 30 días.
- Conversión atómica de guest a cuenta registrada; conserva todos sus activos. Si el teléfono ya tiene cuenta, los activos del guest se incorporan a esa cuenta, sin duplicarlos.
- Configuración posterior: añadir y verificar un email; recuperación por email verificado si se pierde acceso al teléfono, seguida de validación de un nuevo teléfono por SMS.
- QR personal opaco, revocable y validado online; se muestra en la web y se puede guardar directamente en Apple Wallet o Google Wallet una vez que la cuenta está registrada.
- Wallet único, separado visualmente en **Tu Pasaporte** y **Beneficios de comercios**.
- Visualización de puntos, sellos, cupones, créditos de juego, coleccionables y check-ins, siempre con emisor, estado, condiciones y alcance de uso.
- Ciclo de vida guest: inactividad a seis meses, reactivación si vuelve antes de doce meses y eliminación total a doce meses sin actividad.

**No entra:**

- Contraseñas, email obligatorio durante alta, login social, perfil público, transferir/combinar beneficios entre comercios, geolocalización, notificaciones, puntos globales ni gestión de los beneficios desde esta pantalla.

## Diseño

### Experiencia

1. Una persona escanea el QR de un local. Si no tiene sesión, se crea un pasaporte guest y se registra el check-in según la spec 0009.
2. Ve el wallet y un banner: “Protege tu Pasaporte: registra tu teléfono para no perder tus beneficios si cambias o borras este dispositivo”.
3. Al ingresar un teléfono, recibe un OTP SMS de seis dígitos. Verificarlo crea o recupera la cuenta y reclama el pasaporte guest actual.
4. La sesión se mantiene 30 días. Al expirar, se solicita nuevo OTP; nunca contraseña.
5. Una cuenta registrada puede añadir email desde Configuración. El email no queda habilitado para recuperación hasta verificar su enlace/OTP. Recuperar por email abre una sesión limitada que obliga a verificar un número nuevo por SMS antes de completar el cambio.
6. El QR personal se puede mostrar desde web o desde un pass de Apple/Google Wallet. El QR identifica la cuenta ante la app operativa del comercio; no canjea cupones ni contiene datos personales.

La vigencia de un activo no depende de que la cuenta sea guest o registrada:

- Puntos, cupones y créditos de juego siguen la política/configuración de su comercio. El wallet indica si están disponibles o vencidos, pero no altera la regla.
- Sellos y coleccionables de Mi Pasaporte son reconocimientos y no expiran.
- `last_user_activity_at` solo cambia por una acción iniciada por el consumidor: check-in, interacción intencional con wallet, mostrar QR, jugar o canjear. Una asignación de personal no cuenta como actividad del usuario.
- Solo un guest entra en este ciclo: a los seis meses de inactividad pasa a `inactive`; sus activos no se borran. Cualquier actividad antes de los doce meses lo reactiva. Una cuenta registrada no se elimina por esta regla.
- A los doce meses completos sin actividad, se eliminan la cuenta guest y sus activos. Eventos necesarios para métricas se anonimizan o agregan antes de borrar la identidad.

El inicio del wallet prioriza primero los elementos accionables del comercio y luego el progreso de Pasaporte:

```text
Beneficios para usar
  [Bar A] 15% en comida · vence hoy
  [Bar C] 1 jugada disponible

Tu Pasaporte
  Ruta de la cerveza · 2 de 5 check-ins
  Coleccionable: Primera pinta

Tus comercios
  [Bar A] 120 puntos · próximo premio a 200
```

### Especificación técnica

#### Modelo lógico

| Entidad | Campos/invariantes relevantes |
|---|---|
| `consumer_account` | `id`, `status` (`guest`/`registered`/`inactive`), `phone_e164` único y nullable solo para guest, `phone_verified_at`, `email` único nullable, `email_verified_at`, `last_user_activity_at`, `inactive_at`, `created_at`. |
| `guest_credential` | Secreto aleatorio guardado exclusivamente en cookie segura HttpOnly; referencia un `consumer_account` guest. No lleva teléfono ni PII. |
| `auth_challenge` | Destino hasheado, canal (`sms`/`email`), propósito (`sign_in`, `verify_email`, `recover_phone`), hash de OTP, expiración de 10 minutos, máximo de 5 intentos y estado de uso. |
| `session` | Cuenta, dispositivo, expiración a 30 días, revocable. Cookie segura HttpOnly; ninguna credencial de sesión en QR. |
| `wallet_pass` | Cuenta registrada, token aleatorio no adivinable, estado activo/revocado, serial por proveedor. El token es el contenido del QR del pass y no incluye PII. |
| `merchant_points_balance` | Cuenta, comercio, saldo no negativo y registro contable de movimientos con política/fecha de expiración; no existe un saldo global. |
| `merchant_stamp_progress` | Cuenta, comercio y versión de programa, cantidad acumulada y objetivo de tarjeta; representa sellos comerciales, no activos de plataforma. |
| `merchant_entitlement` | Cuenta, comercio/local, tipo (`coupon`/`game_credit`), condiciones, vigencia, estado (`available`, `used`, `expired`, `revoked`) y emisor de campaña. |
| `passport_asset` | Cuenta, tipo (`stamp`/`collectible`), emisor `platform`, reto/ruta opcional, estado y metadatos de presentación. |
| `checkin` | Cuenta, local, hora y resultado; evento de Pasaporte, no cupón ni punto. |

Los puntos son un saldo por comercio; los sellos comerciales son progreso de una tarjeta
del programa del comercio; los sellos y coleccionables de Mi Pasaporte son activos de
plataforma. Cupones y créditos de juego son derechos concretos de un comercio. El wallet
es una proyección de estas entidades, no una tabla genérica que mezcle sus reglas.

#### Operaciones y autorización

| Operación | Actor | Resultado esperado |
|---|---|---|
| Solicitar OTP SMS | guest o visitante | Challenge sujeto a límites por teléfono y dispositivo; no revela si el teléfono ya existe. |
| Verificar OTP | guest o visitante | Crea/inicia cuenta registrada y reclama de manera idempotente los activos del guest actual. |
| Añadir/verificar email | cuenta registrada | Guarda email solo tras verificación; rechaza email ya asociado a otra cuenta. |
| Recuperar por email | visitante con email verificado | Sesión limitada y flujo obligatorio de validación de teléfono nuevo. |
| Mostrar QR personal | owner de la sesión o pass Wallet | Devuelve token opaco activo. |
| Consultar wallet | owner de la sesión | Devuelve solo sus activos, agrupados por emisor y comercio. |
| Resolver QR para operación | `staff` autorizado del comercio | Devuelve identificación operativa y beneficios de su comercio; nunca activos de plataforma ni de otros comercios. |

El QR del pass es estable para evitar fricción y permitir uso directo desde Wallet. El servidor valida su estado en cada lectura. Revocar el pass invalida inmediatamente su QR; emitir uno nuevo no altera la cuenta ni sus beneficios. Los cupones tendrán códigos de canje separados, definidos en la spec 0006.

Las reclamaciones guest y los cambios de teléfono deben ser transacciones: los activos se mueven una sola vez y no pueden quedar asociados a dos cuentas. SMS/email se envían de forma asíncrona; los reintentos no generan challenges utilizables en paralelo.

### Arquitectura de referencia

Esta feature consume las futuras decisiones transversales documentadas en `docs/ARCHITECTURE.md`: autenticación/sesiones, SMS OTP, email, base de datos, Wallet, pruebas y despliegue. No elige esos componentes.

## Archivos

Las rutas concretas se completan cuando la arquitectura haya fijado convenciones de repositorio. Esta dependencia no cambia el alcance ni el contrato de la feature.

| Área | Acción |
|---|---|
| Migraciones de identidad, sesiones, OTP, pass y proyección de wallet | crear |
| Servicios de OTP, sesiones, merge guest y recuperación | crear |
| Rutas/pantallas de wallet, registro, configuración y recuperación | crear |
| Adaptadores Apple Wallet y Google Wallet | crear |
| Pruebas de unidad, integración y end-to-end de los flujos | crear |

### Disjunta?

No. Requiere los roles de 0001, locales de 0002 y produce/consume check-ins de 0009, beneficios de 0005 y cupones de 0006.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Roles de backoffice y aislamiento por comercio | 0001 | Antes de la consola 0005 |
| Locales y QR de check-in | 0002 | Antes de 0009 y de la entrada guest |
| Contrato de check-in | 0009 | Antes de integrar la entrada por QR |

## Definition of Done

- [ ] Escanear un QR de local sin sesión crea un pasaporte guest y muestra el banner de riesgo de pérdida.
- [ ] Un guest puede acumular y consultar puntos, sellos, cupones, créditos de juego, coleccionables y check-ins que le hayan sido emitidos.
- [ ] Puntos, cupones y créditos respetan su vigencia de comercio; sellos y coleccionables de Mi Pasaporte no expiran.
- [ ] El registro pide solamente teléfono y OTP SMS; no pide ni almacena contraseña.
- [ ] Verificar el OTP vincula los activos guest a la cuenta de teléfono, sin pérdida ni duplicación.
- [ ] Una sesión autenticada dura 30 días; al expirar, el acceso requiere un nuevo OTP.
- [ ] Configuración permite añadir y verificar email sin bloquear el registro inicial.
- [ ] Una persona con email verificado puede recuperar el acceso y asociar un teléfono nuevo mediante verificación SMS.
- [ ] Una cuenta registrada puede añadir su QR personal opaco a Apple Wallet o Google Wallet y un empleado autorizado puede resolverlo.
- [ ] El QR de cuenta no contiene teléfono, email, nombre ni un identificador interno; revocarlo impide resolverlo.
- [ ] El wallet separa activos de **Tu Pasaporte** de beneficios de comercios y nunca presenta un saldo global de puntos.
- [ ] Un comercio solo puede consultar/operar los beneficios emitidos por ese comercio; los sellos, coleccionables y activos de otros comercios no aparecen en su consola.
- [ ] Un guest pasa a `inactive` tras seis meses sin actividad iniciada por usuario, puede reactivarse antes de doce meses y se elimina con todos sus activos tras doce meses sin actividad.

## Plan de pruebas y verificación

- [ ] Unidad: generación, vencimiento, máximo de intentos y uso único de OTP; límites de solicitud no filtran existencia de cuenta.
- [ ] Unidad: merge guest -> registrada es idempotente y conserva todos los tipos de activo una sola vez.
- [ ] Unidad: QR/pass opaco no expone PII, y un pass revocado se rechaza.
- [ ] Integración: QR de local -> guest -> emisión de fixtures de los seis tipos de activo -> SMS OTP -> wallet registrada con mismos activos.
- [ ] Integración: teléfono existente + guest nuevo incorpora activos sin duplicar y mantiene historial.
- [ ] Integración: email verificado permite recuperación y cambio de teléfono; email no verificado o ajeno se rechaza.
- [ ] Integración de autorización: staff de Bar A solo resuelve activos de Bar A; no ve Bar B ni activos `platform`.
- [ ] Prueba con reloj controlado: un beneficio de comercio expira según su política y un sello de Pasaporte permanece disponible.
- [ ] Prueba con reloj controlado: guest a seis meses pasa a `inactive`, se reactiva antes de doce meses y se elimina/anonimiza a los doce meses sin actividad.
- [ ] End-to-end manual iOS: agregar el QR de una cuenta registrada a Apple Wallet, escanearlo desde consola y revocarlo.
- [ ] End-to-end manual Android: agregar el QR de una cuenta registrada a Google Wallet, escanearlo desde consola y revocarlo.
- [ ] Comandos exactos de test, typecheck, lint y build se añaden desde la arquitectura; la spec no puede pasar a `cerrada` sin ellos.

## Handoff requerido

El implementador y revisor usarán el formato de `docs/AGENT-WORKFLOW.md`; la evidencia incluirá registros de pruebas sin OTP, teléfonos, emails ni tokens reales.

## Abierto

No hay decisiones de producto abiertas para esta feature. Las decisiones transversales de tecnología se documentarán en `docs/ARCHITECTURE.md`.
