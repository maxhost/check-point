# Plan SEO/GEO público del comercio — 2026-10-10

## Decisiones del owner

- Posicionar contenido público del producto para comercios en checkpass.club.
- Excluir business.checkpass.club, admin.checkpass.club y my.checkpass.club de índices.
- Conservar precios de la landing. Cashback: Próximamente.
- No hay casos reales: no crear testimonios ni cifras ficticias.
- Crear tres páginas en paralelo y después ajustar con el owner en localhost.

## Primera entrega local

1. Páginas de fidelización, marketing y punto de venta (specs 0191, 0192, 0193), enlaces desde landing y sitemap.
2. Metadata de raíz actualizada, WebSite junto a Organization y WebPage.
3. Noindex en layouts de merchant y consumer (0194); admin y cabeceras globales se encargan a Claude.
4. Cashback rotulado Próximamente. Precios conservados.

## Capturas del producto

Obtener capturas del producto actual con datos de demostración, recortadas al foco. Nunca screenshots de clientes reales ni resultados de negocio simulados como evidencia.

- Fidelización: editor del programa y vista de pase, junto a la explicación de puntos/sellos y unión por QR.
- Marketing: lista/activación de campañas, junto a la explicación del envío automático. No mostrar funciones sin implementar.
- POS: catálogo/importación IA, mesas y detalle de pedido, junto a cada paso.

Priorizar páginas interiores. Mantener los gráficos sintéticos de la landing hasta revisar juntos capturas y legibilidad móvil. Guardar assets aprobados en apps/public/public/images/producto, con alt contextual y dimensiones; no capturas gigantes sin foco.

## Presentación social y confianza

- Crear imagen social de marca y propuesta (Open Graph/Twitter).
- Comprobar logo/perfiles/contacto públicos reales para Organization.
- Añadir casos reales cuando existan y haya autorización. No bloquea esta entrega.

## Antes de live

- Revisar contenido y layout móvil/escritorio con owner.
- Validar metadata, canonical, enlaces, sitemap y noindex en producción.
- Publicar solo las funciones disponibles; cashback sigue Próximamente.
- Conectar Search Console y Bing Webmaster Tools y enviar sitemap.
- Medir indexación, consultas, clics y registros. No asignar resultados a local.

## Encargo concreto a Claude: noindex en subdominios privados

El owner pide que no se indexen business, admin ni my. GPT aplica robots index false / follow false a layouts merchant/consumer. Claude debe:

1. Añadir noindex en el layout raíz del panel de plataforma mientras implementa 0190 (zona Claude completa).
2. Cubrir los tres hosts con X-Robots-Tag: noindex, nofollow en cabeceras globales, incluyendo respuestas no HTML cuando corresponda. Elegir el lugar compatible con su configuración actual de Next/hosting; no modificar contratos ni auth.
3. No usar Disallow: / como sustituto de noindex: el rastreador necesita leer la directiva. Revisar configuración actual y evitar reglas contradictorias.
4. Verificar cabeceras en rutas públicas de acceso; autenticación sigue protegiendo datos privados.
5. Sin push/publicación hasta autorización del owner. Tras deploy, comprobar que no hay overrides indexables y gestionar retirada en Search Console si ya existen URLs indexadas.

Fuente: https://developers.google.com/search/docs/crawling-indexing/block-indexing
