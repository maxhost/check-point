---
spec: 0001
fecha: 2026-08-09
estado: borrador
resumen: Define dominios de acceso, roles de backoffice, membresías de comercio y auditoría base; la identidad de consumidor vive en la spec 0004.
disjunta: no
archivos: por definir tras elegir el stack web y base de datos
---

# 0001 — Acceso de backoffice, membresías y auditoría

## Problema

La V1 necesita separar el backoffice interno de plataforma del backoffice de comercios, y evitar que el personal de un comercio acceda a recursos fuera de sus asignaciones.

## Alcance

**Entra:**
- Dominio de acceso de plataforma: `platform_admin` y `platform_staff`, con email y contraseña y backoffice exclusivo.
- Dominio de acceso de comercio: `owner` y `merchant_staff`, con backoffice separado del de plataforma.
- Un negocio puede tener N owners; un owner puede pertenecer a N negocios y cada negocio N locales.
- Un `merchant_staff` puede pertenecer a N negocios y, dentro de cada negocio, estar asignado a N locales o a todos sus locales.
- El merchant staff usa el backoffice de comercio limitado por permisos y una página operativa específica para escanear QR, asignar y validar beneficios.
- Entidades base: cuentas de plataforma, cuentas de comercio, negocio, local, membresía de owner/staff y evento auditable.
- Identificadores de usuario y local no predecibles.

**No entra:**
- Registro autoservicio de comercios, SSO, recuperación por WhatsApp, y funcionalidades de plataforma más allá de clientes, negocios y locales.

## Diseño

Los dominios de consumidor, plataforma y comercio tienen sesiones y rutas independientes. Todo recurso comercial lleva `merchant_id` y `venue_id`; toda acción de personal registra actor, negocio/local y hora. La autorización se verifica en servidor. La identidad, sesiones y recuperación del consumidor se definen en la spec 0004; nunca habilitan acceso al backoffice.

Una membresía de `merchant_staff` no es una propiedad única en la cuenta: es una asignación por negocio, con alcance `all_locations` o un conjunto explícito de locales. Una cuenta de comercio puede ser owner de un negocio y merchant_staff de otro; no comparte sesión ni permisos con una cuenta de consumidor.

Los permisos finos se cierran después de definir los módulos que un owner puede gestionar: programa de fidelización, catálogo de productos/premios, campañas, eventos, distribución, juegos, reservas, operación y analítica. No se reducirá el modelo a un CRUD aislado de cupones. Se distinguen dos alcances: **negocio** para configuración global (por ejemplo editar campañas) y **local** para visibilidad/operación de campañas activas en locales asignados.

Cada evento auditable incluye referencias opcionales a actor, negocio, local y objeto afectado, además de snapshots inmutables de texto/valores relevantes. Eliminar una fuente puede dejar la clave en `null`; nunca elimina el contexto histórico de una asignación, canje o modificación.

El ciclo completo de `merchant_staff` —crear, editar, asignar a locales, desactivar/reactivar y cambiar permisos— es exclusivo del owner de ese negocio. Ni `platform_admin` ni `platform_staff` pueden realizar esas acciones. `platform_staff` solo tiene CRU sobre clientes, negocios y locales; no obtiene permisos sobre funcionalidades de comercio aún no definidas.

Eventos mínimos: `consumer_checked_in`, `purchase_credited`, `opportunity_issued`, `game_played`, `coupon_issued`, `coupon_redeemed`, `campaign_activated` y `campaign_paused`.

## Archivos

| Archivo | Acción |
|---|---|
| Base de datos, autenticación y middleware de autorización | crear; ruta concreta depende del stack elegido |
| Esquema de tipos de dominio y registro de eventos | crear |

### Disjunta?

No. Es fundamento compartido por las specs 0002–0007; se implementa primero.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Modelo de identidad, autorización y eventos | Implementación de 0001 | Antes de 0002 |

## Verificación

- [ ] Un `merchant_staff` puede tener acceso a varios negocios/locales y no puede consultar ni modificar recursos fuera de sus asignaciones.
- [ ] Una sesión de consumidor, una de plataforma y una de comercio no se aceptan entre sus respectivos backoffices/rutas.
- [ ] Un staff limitado a un local puede operar una campaña activa en ese local, pero no editar su configuración global.
- [ ] Un registro histórico mantiene snapshots de actor y objetos relevantes aunque sus claves de fuente se eliminen.
- [ ] Las rutas/API de gestión de merchant staff rechazan a `platform_admin`, `platform_staff` y otros owners; solo un owner del negocio objetivo puede usarlas.
- [ ] Cada acción protegida deja un evento atribuible a usuario o personal.

## Abierto

- Elegir proveedor de autenticación, base de datos y estructura de la aplicación web antes de cerrar rutas de archivo.
