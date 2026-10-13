# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clientes de comercios con programas de fidelización. Acceden principalmente desde el teléfono, mediante un QR del comercio o directamente a my.checkpass.club.

## Product Purpose

CheckPass reúne el pase y los beneficios del cliente y permite unirse a programas de comercios usando una misma cuenta.

## Operating Context

La entrada directa sin sesión invita a iniciar sesión en la wallet para acceder al pase y los beneficios. Google y Apple son las opciones de autenticación.

El QR de un comercio lleva a una invitación a su programa, identificada con el nombre del negocio. Sin sesión, autenticarse con Google o Apple permite inscribirse. Con sesión, el cliente confirma que quiere unirse a ese nuevo programa sin volver a autenticarse.

Después de inscribirse, una confirmación invita a añadir CheckPass a la pantalla de inicio. Las instrucciones dependen del dispositivo. El diseño solicitado es mobile first.

## Capabilities and Constraints

La implementación contempla clientes que ya pertenecen al programa, cambio de cuenta, programas no disponibles y errores de autenticación. La inscripción con sesión requiere una acción explícita del cliente.

La wallet existente contiene Beneficios, Programas, Pase y Cuenta, además de actividad. El owner eligió Club cotidiano (concepto2) con paletaA: verde profundo y coral, blanco y superficies claras. Aprobó los mocks HTML/CSS0207 y autorizó aplicar ese diseño a las páginas reales en0208: /wallet sin sesión, /enroll/[programId] y /enroll/[programId]/ready. La wallet interna con sesión, sus pestañas y actividad conservan el diseño existente. Implementación local para revisión; publicación todavía no autorizada.

## Brand Commitments

Nombre: CheckPass. La invitación debe identificar al comercio con nombre y logo real cuando existe; si no hay logo, se utiliza la inicial. Se conservan Google y Apple como proveedores de acceso y sus marcas, enlaces y orden por dispositivo. El copy es neutro e impersonal (`apps/consumer/COPY.md`).

## Evidence on Hand

Pantalla pública de acceso revisada en my.checkpass.club/wallet. Mocks0207 aprobados, en ../../docs/qa/0207/mocks. Implementación0208 en src/app/(consumer)/wallet y src/app/(consumer)/enroll/[programId], con CSS compartido consumer-entry.module.css. Fuente NunitoSans y OFL en public/fonts. Capturas y pruebas de componentes reales con datos ficticios, más acceso Next local, en ../../docs/qa/0208. Ninguna evidencia de prueba afirma autenticación, instalación en teléfono físico ni publicación real.
