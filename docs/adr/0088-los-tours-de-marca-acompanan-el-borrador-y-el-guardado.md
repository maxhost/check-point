---
adr: 0088
fecha: 2026-09-25
estado: aceptada
resumen: Marca incorpora cinco pasos de orientación y seis ayudas sobre el editor existente; el guardado aplica todo el borrador, el afiche tiene un recorrido separado y el acceso respeta el permiso brand.
---

# 0088 — Los tours de Marca acompañan el borrador y el guardado

## Contexto

El owner aprobó la propuesta de Marca: «me cierra, sobre afiche tambien comparto».
El alcance presentado fue una orientación de cinco pasos y seis ayudas: nombre,
cargar/cambiar logo, quitar logo, colores, zona horaria y moneda. Crear afiche se explica
en la orientación; su ayuda completa se diseña como un recorrido aparte.

La pantalla tiene un único borrador y un único Guardar marca. Elegir, recortar o quitar
el logo modifica estado local; la subida ocurre al guardar. La API ya admite owner y
staff con `brand`, pero la página exige `requireOwner()` y la navegación todavía no
publica Marca como superficie delegada. Es una falta de adaptación de UI al ADR 0079.

## Decisiones

1. **Cinco pasos de orientación:** Identidad y logo → Paleta y vista previa →
   Configuración regional → Guardar marca → Ayuda y Crear afiche. Orientar no modifica
   el borrador ni guarda Marca. Sólo este modo registra `completed` o `skipped` del
   tour `brand`, por negocio y exclusivamente para el owner.
2. **Seis ayudas independientes**, con acciones reales sobre los controles existentes.
   Nunca registran progreso. Elegir archivo, aplicar recorte o pulsar Quitar no equivale
   a guardar; la guía espera la respuesta exitosa de `PUT /api/brand`.
3. **El guardado es del borrador completo.** Cada ayuda lo explica antes de Guardar:
   también se aplican cambios pendientes de otras secciones. Iniciar o cerrar una ayuda
   conserva ese borrador. No crear seis formularios ni seis rutas de actualización parcial.
4. **Crear afiche conserva un recorrido separado.** La orientación explica el acceso sin
   navegar ni imprimir. Esta entrega no implementa la ayuda de Brand Kit. Su página sigue
   con su acceso actual de owner; el editor delegado de Marca no ofrece ese enlace al staff.
5. **Alinear Marca con el permiso existente `brand`.** El adaptador server-side de la
   página y la navegación usan la sesión y permisos actuales. Staff autorizado accede
   al editor y sus ayudas; staff sin permiso no accede; nunca persiste onboarding.
6. **Codex implementa UI; Claude Code mantiene API/servidor.** Pasos, copy, anchors y
   estado del recorrido son locales. Los endpoints existentes cubren el alcance; no se
   identifica un encargo backend ni una migración necesarios para estos tours.

La aprobación del owner fija recorridos y separación del afiche. Las reglas de borrador,
recuperación, lifecycle y adaptación de permisos son diseño técnico de ese alcance; no
se presentan como citas adicionales del owner.

## Consecuencias

- Reutilizar Driver.js, el cliente de progreso y los patrones de Staff, Locales y Catálogo.
- El fallo de guardado conserva edición y guía; salir retira sólo el recorrido.
- La moneda cambia cómo se muestran los importes; la ayuda no promete conversión de precios.
- Un conflicto de revisión exige recuperación explícita; no se pisa otra sesión automáticamente.
- La ayuda de afiche queda pendiente de diseño, sin pasos operativos dados por aprobados.

## Referencias

- [Spec 0097](../specs/0097-tours-de-onboarding-y-ayuda-de-marca.md).
- ADR 0078: contenido local, progreso por negocio y estados de onboarding.
- ADR 0079 y spec 0086: permiso `brand` y API delegada.
- ADR 0087 y spec 0096: orientación y ayuda separadas, avance confirmado y salida.
- Specs 0025/0040 y ADR 0047: logo, recorte opcional y límites del servidor.
