---
spec: 0130
fecha: 2026-10-02
estado: cerrada
resumen: Llevar Trama viva al pase de la PWA con QR escaneable y un solo CTA de Wallet según el sistema operativo.
disjunta: no
archivos: apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx, apps/consumer/src/app/(consumer)/wallet/wallet-shell.tsx, apps/consumer/src/app/(consumer)/wallet/page.tsx, apps/consumer/src/app/(consumer)/wallet/page-no-session.test.ts, apps/consumer/src/server/wallet-account-opened.test.ts, apps/consumer/src/app/(consumer)/wallet-cta.tsx, apps/consumer/src/app/wallet.css, apps/consumer/src/app/(consumer)/wallet/qr-tab.test.ts, docs/design-explorations/pwa-pase-trama-viva.html, docs/INDEX.md, docs/TASKS.md
---

# 0130 — Pase PWA «Trama viva»

## Decisión aprobada

El owner aprobó el 2026-10-02 la [maqueta de la pestaña Pase](../design-explorations/pwa-pase-trama-viva.html): cabecera azul profunda con los dos trazos de Trama viva; QR personal en un área blanca separada; instrucciones de uso debajo; acción de Wallet y aviso fuera de la tarjeta. Aclaró que debe aparecer **un solo botón de Wallet**, según el sistema operativo, con la marca visual de Apple Wallet o Google Wallet. Esta spec cierra esa decisión para implementación.

## Experiencia y alcance

1. La pestaña conserva «Tu pase» y la explicación de un código para todos los programas. La tarjeta lleva una cabecera de aproximadamente 140 px con el PNG `wallet-trama-hero-v1.png`, logo `wallet-logo-trama-v1.png` y «CheckPass Club». La imagen es decorativa; el nombre sigue siendo texto legible.
2. El QR permanece generado en servidor por `renderQrSvg(account.qrToken)` y se inserta sin modificar su contenido, nivel de corrección, SVG ni rutas de check-in. Se presenta en blanco con módulos oscuros, margen libre y tamaño efectivo apto para 320 px de viewport. Ningún trazo, sombra ni texto invade el área del QR. El token no aparece como texto ni se registra.
3. Debajo figuran «Mostrá este código en caja» y la instrucción existente sobre puntos, sellos y beneficios. La frase «Tu pase para volver a los lugares que hacen ciudad» puede acompañar la acción de Wallet fuera de la tarjeta. No se agrega un nivel, rango ni nombre de comercio al pase global.
4. **CTA único y visible desde la primera visita a la pestaña:** iPhone/iPad/iPod recibe «Añadir a Apple Wallet» con logo Apple blanco sobre negro y `href=/api/public/wallet/apple.pkpass`; otros dispositivos reciben «Añadir a Google Wallet» con marca Google Wallet y `href=/api/public/wallet/google`. No se renderiza el enlace del otro proveedor. Se reutiliza la detección `isIos` que ya resuelve `/wallet` en servidor. El popup de Wallet de la segunda apertura puede seguir funcionando, pero no controla la visibilidad del botón de esta pestaña.
5. La invitación a avisos sigue debajo del CTA y conserva su lógica de Web Push e instalación iOS. No se convierten los elementos de la maqueta en botones sin acción.
6. La tarjeta debe funcionar en PWA instalada y navegador móvil, en 320 px y más, con texto aumentado y modo claro/oscuro. La superficie del QR permanece blanca en ambos temas. Animación decorativa no es requisito de esta versión: claridad de lectura y estabilidad durante el escaneo tienen prioridad.

### Marca de los botones

El CTA ya compartido en `wallet-cta.tsx` selecciona una plataforma y tiene sus colores. Se reemplaza el glifo de uso privado de Apple por un SVG legible y se verifica que cada enlace conserva icono, color, texto y destino propios. El CTA no adopta el verde de CheckPass ni presenta ambas plataformas a la vez. Los [lineamientos de Apple](https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/) y [Google Wallet](https://developers.google.com/wallet/generic/resources/brand-guidelines?hl=es-419) recomiendan sus distintivos provistos; cualquier sustitución por esos archivos oficiales se hará cuando el asset autorizado esté disponible, sin redibujar sus distintivos.

## Contratos y archivos

- `qr-tab.tsx`: estructura semántica de la tarjeta, logo/arte y CTA siempre visible; mantiene `qrSvg` en el mismo nodo funcional y `PushPrompt` fuera de la tarjeta.
- `wallet.css`: diseño responsivo de cabecera, tarjeta y QR. La ilustración va en la cabecera, no bajo el código. Las reglas existentes de otras pestañas no cambian.
- `wallet-shell.tsx`: elimina la condición de segunda apertura para el botón de esta pestaña; preserva el popup y el registro de apertura existentes.
- `wallet-cta.tsx`: mantiene ambos destinos y la selección por `isIos`; usa un símbolo Apple fiable y estilos de marca.
- `page.tsx`: ajusta la firma de props exigida por Next 16 para que el build pueda validar la ruta; los tests que invocan la página llaman con `{}`. No cambia la sesión ni el contenido de la página.
- Ninguna tabla, endpoint, token, pase Apple/Google nativo ni flujo de emisión cambia.

## Definition of Done

- [ ] Pestaña «Pase» muestra la composición aprobada y el QR real generado por el servidor sin alterar el valor.
- [ ] En iOS hay exactamente un CTA de Apple; fuera de iOS, exactamente uno de Google. Ambos tienen el nombre, icono, color y destino correspondientes; aparecen en la primera visita a la pestaña.
- [ ] QR visualmente separado de la trama, legible a 320 px y escaneado en mostrador de QA; no hay token visible en HTML decorativo ni logs.
- [ ] Avisos, navegación de pestañas y popup de Wallet de la segunda apertura siguen operativos.
- [ ] Verificados modo claro/oscuro, fuente grande, PWA instalada y navegador móvil en teléfono real.
- [ ] Revisor independiente emite PASS antes de marcar `implementada` según `docs/AGENT-WORKFLOW.md`.

## Verificación

1. Test de render del CTA y de la pestaña: QR SVG de prueba sin cambiar, una sola plataforma por `isIos`, destinos y marcas. No usar token real en el test.
2. `pnpm exec vitest run 'apps/consumer/src/app/(consumer)/wallet/qr-tab.test.ts'` y los tests de Wallet afectados.
3. `pnpm --filter @mi-pasaporte/consumer typecheck`, lint de archivos tocados, `pnpm --filter @mi-pasaporte/consumer build`.
4. QA en dispositivo: abrir la pestaña en iPhone y Android, escanear el QR de una cuenta de prueba en mostrador y comprobar ambos enlaces, a 320 px y texto grande. Registrar versión del SO y resultado sin capturar tokens.

La verificación local no sustituye el QA de teléfono ni el PASS independiente. Hasta entonces el estado permanece `cerrada`, con implementación local pendiente de esas comprobaciones.
