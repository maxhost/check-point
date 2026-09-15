---
spec: 0059
fecha: 2026-09-08
estado: implementada
resumen: Las cargas de logo, sello y producto muestran que están preparando la imagen y en móvil ofrecen una acción explícita para abrir la cámara trasera, además de galería.
disjunta: no
archivos: `src/app/backoffice/{brand,catalog,loyalty}/**`, `src/app/components/**`, `src/app/globals.css`, pruebas y docs
---

# 0059 — Captura de imagen móvil con feedback

## Problema

El análisis previo al cropper puede tardar hasta ocho segundos sin feedback. En Android el
selector de galería no ofrece cámara aunque la ayuda lo prometía.

## Diseño

Los tres hooks de imagen exponen `isAnalyzing` desde que comienza `resolveDecodableImage`
hasta que resuelve. Cada superficie muestra `Preparando imagen…` mientras está activo y evita
un segundo selector simultáneo. En pantallas táctiles conserva el selector de galería y suma
un botón «Tomar foto» que activa un input separado con `accept="image/*"` y
`capture="environment"`; ambos caminos pasan por el mismo `choose()` y cropper.

No cambia formatos, límite de 5 MB, fallback HEIC, subida ni servidor. En escritorio no se
muestra el control de cámara.

## Definition of Done

- [x] Logo, sello y producto muestran el feedback durante el análisis y lo limpian al terminar — `«Preparando imagen…»` colgado de `isAnalyzing` en las tres superficies (`brand-page.tsx:219`, `step-card-design.tsx`, `product-image-field.tsx:76`).
- [x] En móvil cada una ofrece galería y «Tomar foto»; ambas usan la misma validación/cropper — las dos entradas llaman al MISMO `choose(...)`, así que no hay un segundo camino de validación que pueda divergir.
- [x] Escritorio conserva el selector actual y no recibe captura de cámara — **verificado leyendo las tres**: el `capture="environment"` vive DENTRO de `{isTouch && (…)}`, y el `accept` cae a `ACCEPTED_IMAGE_ACCEPT_ATTR` cuando no es touch.
- [x] Tests, typecheck, lint, formato y build pasan (suite completa verde al 2026-09-15).

## Abierto

Nada.


## Cierre (2026-09-15)

Marcada `implementada` **por decision del owner** — «marcalos como implementados, ya estan corriendo»:
esta en produccion y en uso, que es la señal que el modelo no genera.

**Lo que se verifico de verdad antes de marcar** (no se marco por decreto): las tres superficies tienen
el feedback colgado de `isAnalyzing`, las dos entradas comparten el mismo `choose(...)`, y el
`capture="environment"` esta **dentro** del guard `isTouch` en las tres — o sea que el item de
escritorio, que era el unico sin respaldo, quedo comprobado por lectura del codigo.

## Oraculo (2026-09-15) — el limite de arriba QUEDO CERRADO en su parte principal

Cuando esta spec se marco `implementada` se declaro que **ningun test pinneaba este comportamiento**.
El owner pidio cerrarlo y se escribio **`app/backoffice/catalog/image-capture.test.ts`** — 6 tests, que
renderizan el componente REAL (`renderToStaticMarkup` + `node-html-parser`, **bundleado en `next`**:
cero paquetes nuevos, bajo el `environment: "node"` que ya usa merchant).

**NO es un barrido sintactico.** La propiedad es de COMPORTAMIENTO («en escritorio no aparece la
camara»), y este repo tiene tres guards por `grep` rotos por tres revisores distintos. Aca se consulta
el HTML emitido con un motor CSS.

**LAS DOS MUTACIONES SE EJECUTARON Y ESTE ES EL RESULTADO TRANSCRIPTO, no predicho:**

| id | mutacion | resultado |
|----|----------|-----------|
| M1 | anular el guard `isTouch` (la camara se renderiza siempre) | **ROJO 1/6** — «en ESCRITORIO no emite ninguna entrada con `capture`». Asercion: `expected [ HTMLElement ] to have a length of +0 but got 1`. Habla de la propiedad. |
| M2 | colgar «Preparando imagen…» de `true` en vez de `isAnalyzing` | **ROJO 1/6** — «muestra «Preparando imagen…» SOLO mientras analiza». Asercion: `expected 'Imagen (opcional)Preparando imagen…' not to contain 'Preparando imagen…'`. |

Las dos se revirtieron con `diff` contra la copia limpia y `shasum` verificado
(`75c467e0da9f11298e3493752a4731f10bb63ddd`).

**UN ROJO QUE ERA DEL TEST Y NO DEL PRODUCTO, anotado porque es la trampa de siempre:** la primera
version pedia `disabled` en el `<input capture>` y daba rojo con el codigo SANO. Ese input es
`sr-only` y **no es alcanzable por el usuario** — existe para que el boton le haga `.click()`, y quien
gatea de verdad es el boton. Se corrigio la asercion al mecanismo real, no el producto.

**LO QUE SIGUE SIN ORACULO, con el intento hecho y no supuesto:** de las TRES superficies, el test
cubre **producto**. Queda afuera:
- **Sello** (`step-card-design.tsx`): alcanzable —usa solo 3 campos del vm— pero el componente pide un
  `LoyaltyVm` COMPLETO y el doble exigiria un `as unknown as`, que apaga el typecheck que el doble de
  `CatalogImage` se compra. **Pendiente, no imposible.**
- **Logo** (`brand-page.tsx`): **no** por render estatico — carga su estado en un `useEffect` que no
  corre en SSR, asi que con `brand === null` devuelve `<BrandSkeleton/>` (`brand-page.tsx:130`) y el
  formulario con la camara nunca se emite. **Verificado leyendo el codigo.** La tecnica que si lo
  alcanza es la de `confirm-dialog-focus.test.ts` (`vi.mock("react")` sobre los hooks).

**El riesgo que queda es acotado y explicito:** el guard de esas dos superficies puede romperse sin que
la suite lo note. Lo que si esta pinneado es el mecanismo compartido (`useIsTouch`) y el cableado de
producto.
