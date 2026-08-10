---
spec: 0008
fecha: 2026-08-09
estado: borrador
resumen: Permite al administrador de Mi Pasaporte cargar negocios y curar categorías, rutas y eventos explorables.
disjunta: no
archivos: depende de 0001, 0002 y 0004; rutas concretas por definir
---

# 0008 — Administrador, rutas, categorías y eventos

## Problema

Una colección de wallets de comercios no crea una red de descubrimiento. Mi Pasaporte necesita una capa editorial propia para organizar locales y ofrecer razones para explorar, sin tomar control de sus campañas.

## Alcance

**Entra:**
- Panel exclusivo de `platform_admin` para crear, editar, publicar, ocultar y ordenar negocios.
- Categorías editoriales: por ejemplo bares, cerveza artesanal y restaurantes románticos.
- Rutas: título, portada, descripción, orden de negocios, fechas opcionales y estado publicado.
- Eventos: título, descripción, fecha/hora, imagen, locales participantes y estado publicado.
- Vista pública de exploración con categorías, rutas, eventos y fichas de negocios.

**No entra:**
- Autoalta de comercios, pagos, reseñas, mapa, reservas, venta de entradas, campañas de marcas o beneficios cruzados por ruta.

## Diseño

El administrador controla publicación y curaduría; el dueño controla exclusivamente su perfil operativo, programa y campañas. Una ruta puede mostrar progreso visual de check-ins, pero no entrega ni mueve puntos, oportunidades o cupones entre sus negocios.

## Archivos

| Archivo | Acción |
|---|---|
| Modelos de categoría, ruta, evento y relaciones | crear |
| Panel de administrador de plataforma | crear |
| Exploración pública y fichas de negocio | crear/editar wallet 0004 |

### Disjunta?

No. Comparte roles, comercios y exploración del consumidor con 0001, 0002 y 0004.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Rol platform_admin | 0001 | Antes de esta spec |
| Negocios publicados | 0002 | Antes de esta spec |

## Verificación

- [ ] Un administrador publica una ruta con dos bares y un consumidor la puede explorar.
- [ ] Un dueño no puede editar rutas, categorías ni eventos.
- [ ] Publicar una ruta no altera saldos ni condiciones de beneficios de los locales.

## Abierto

- Definir la fuente inicial de fotos y la política de revisión antes de publicar más allá de los dos bares aliados.
