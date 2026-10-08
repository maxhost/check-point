# Caché de JavaScript en los túneles de desarrollo

Estado: diagnóstico verificado; configuración de Cloudflare pendiente. Rama `dev`, sin merge ni push.

El owner sigue viendo `Cannot read properties of undefined (reading 'peek')` al abrir
Nueva orden después de reiniciar Next y hacer hard refresh. El mapa de fuente apunta
a `pos-console.tsx:515`, donde la fuente actual tiene un diálogo, no el efecto.
La fuente actual de PosConsole pasa `cache` y `catalogRevision` a PosEditor.
La hipótesis inicial de caché exclusivamente local de Turbopack fue insuficiente.

## Evidencia

Para el mismo chunk `/_next/static/chunks/apps_merchant_src_app_backoffice_0lkylwx._.js`:

| Acceso | Cabeceras observadas |
| --- | --- |
| `http://127.0.0.1:3201` | `Cache-Control: no-cache, must-revalidate` |
| `https://dev-business.checkpass.club` | `Cache-Control: max-age=14400, must-revalidate`; `CF-Cache-Status: EXPIRED` |

Cloudflare transforma la política del origen en cuatro horas de caché del navegador.
El nombre de este chunk de desarrollo se mantiene entre modificaciones; conservarlo
puede mezclar componentes de distintas versiones. Es una explicación consistente
con el error y el mapa de fuente, aunque no se capturó el JavaScript de la pestaña
del owner para demostrar que esa copia concreta causó el fallo.

Tras la petición que devolvió `EXPIRED`, los cuerpos local y remoto coincidieron:
270413 bytes; SHA-256 `4b1efd4457a9cb85e01d42b2912d7f82fcbc625548cd15f1381c4e03d425808a`.
Evidencia temporal: `/private/tmp/pos-chunk-{local,tunnel}.{js,headers}`.

Se verificó también la página real de Next con Playwright y sesión del owner ficticio
de la semilla local, primero dirigiendo solicitudes al origen y después por Cloudflare.
En ambos casos se abrió Nueva orden y se mostró el catálogo, sin errores de página.
Solo se simularon habilitación POS y lecturas de catálogo/historial; no se crearon órdenes
ni se modificó la configuración del negocio. Script temporal:
`/private/tmp/checkpoint-pos-next-live.cjs`.

## Cambio para Claude / administración de Cloudflare

Configurar exclusivamente los hosts de desarrollo con esta condición:

```text
(http.host eq "dev-business.checkpass.club" or http.host eq "dev-my.checkpass.club")
```

1. Establecer **Cache eligibility: Bypass cache** para esta condición.
2. Revisar la política de **Browser Cache TTL** aplicable a estos hosts y hacer que
   respete las cabeceras del origen. Eliminar la sobreescritura a `max-age=14400`
   para desarrollo. Revisar tanto reglas como valores heredados de la zona.
3. Ordenar las reglas de modo que otra regla coincidente no restablezca el caché:
   para ajustes en conflicto prevalece la última regla coincidente.
4. Purgar las entradas existentes de estos hosts una vez aplicado el cambio.
   Una purga del CDN no elimina por sí sola copias ya almacenadas en el navegador;
   después comprobar con caché deshabilitada o una sesión nueva del navegador.

Documentación oficial:
[ajustes de Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/),
[orden de reglas](https://developers.cloudflare.com/cache/how-to/cache-rules/order/),
[TTL de edge y navegador](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).

## Criterio de cierre

El chunk remoto debe conservar la política `no-cache` del origen sin añadir cuatro
horas de frescura; el edge no debe reutilizar una versión previa. El owner debe abrir
Nueva orden y otra orden desde historial sin el error, también después de una edición
local y recarga. La caché de órdenes de la spec 0172 conserva sus reglas aprobadas:
sin TTL, sin polling y sin nuevas consultas por foco o recarga de recursos JavaScript.

GPT no dispone de una herramienta conectada a la cuenta de Cloudflare para aplicar
esta configuración. No se cambió fuente, servidor, tooling ni la configuración remota.
