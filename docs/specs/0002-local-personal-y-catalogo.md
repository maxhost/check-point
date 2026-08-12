---
spec: 0002
fecha: 2026-08-09
estado: borrador
resumen: Permite al dueño preparar su negocio, personal, identidad de marca y catálogo con datos económicos.
disjunta: no
archivos: depende de 0001 y del stack elegido
---

# 0002 — Backoffice del negocio y catálogo económico

## Problema

El wizard no puede proteger margen si el local no declara qué vende, a qué precio y cuánto le cuesta. El dueño necesita preparar esa información sin intervención del equipo de Mi Pasaporte.

## Alcance

**Entra:**
- Perfil de negocio/local: nombre, logo, colores, descripción, dirección de texto y QR de check-in.
- Programa de fidelización a nivel negocio, opcional y único activo, conforme a ADR 0020.
- Estado operativo de local: `active` o `closed`, conservando historial al cerrar.
- Alta, desactivación y listado de miembros de personal.
- Catálogo manual: nombre, categoría, precio de venta, coste unitario y estado activo/inactivo.
- Categorías iniciales: cerveza, comida, cóctel, combo y otro.
- Validación de valores monetarios no negativos y precio mayor que coste para productos que se usarán en reglas económicas.

**No entra:**
- Inventario, recetas, proveedores, facturación, importación POS o edición masiva.

## Diseño

Un owner puede gestionar N negocios y cada negocio N locales. Cerrar un local detiene check-ins y operación en ese sitio, pero no elimina el programa ni historial del negocio. El QR de check-in es fijo por local; acredita presencia, nunca una compra. El backoffice es la superficie desde la que el dueño llega al programa, campañas, personal y métricas. La pertenencia exacta de catálogo/producto (negocio con variantes por local, o solo local) se cerrará al profundizar esta spec.

## Archivos

| Archivo | Acción |
|---|---|
| Modelo y migraciones de local, personal y producto | crear/editar sobre 0001 |
| Pantallas del dueño para perfil, personal y catálogo | crear |
| Generación de QR de local | crear |

### Disjunta?

No. Consume identidad de 0001 y sus productos son contrato de 0003 y 0005.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Identidad y autorización | 0001 | Antes de esta spec |

## Verificación

- [ ] Un dueño puede crear cinco productos con precio y coste desde móvil.
- [ ] Un miembro de personal no puede cambiar catálogo ni miembros.
- [ ] Un QR identifica el local correcto al escanearlo.

## Abierto

- Elegir el stack técnico que define nombres de rutas y archivos.
