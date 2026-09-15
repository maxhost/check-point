import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error — build interno de Next, sin tipos. Cero paquetes nuevos: ver el docblock.
import { parse } from "next/dist/compiled/node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0059 — EL ORACULO QUE ESA SPEC NO TENIA.
 *
 * La 0059 se marco `implementada` (esta en prod y en uso) con un limite declarado: **ningun
 * test pinneaba la captura de camara**, asi que se podia romper «Tomar foto» —o sacarle el
 * guard `isTouch` y darle camara al escritorio— con los 5 gates en verde. Esto lo cierra.
 *
 * POR QUE UN RENDER REAL Y NO UN BARRIDO DE TEXTO: la propiedad es de COMPORTAMIENTO («en
 * escritorio no aparece la camara»), y `CLAUDE.md` tiene tres guards sintacticos rotos por tres
 * revisores distintos como prueba de que un `grep` sobre el `.tsx` siempre tiene preimagen. Acá
 * se renderiza el componente de verdad y se consulta el HTML con un motor CSS.
 *
 * `node-html-parser` VIENE BUNDLEADO EN `next`: no hace falta `jsdom` ni instalar nada bajo el
 * `environment: "node"` del vitest de merchant.
 *
 * ES UN `.ts` SIN JSX A PROPOSITO: `vitest.config.ts` incluye `src/*.test.ts`, no `.tsx`, y
 * cambiar esa config compartida para acomodar un test es mover el piso de los otros 130
 * archivos. `createElement` alcanza.
 *
 * POR QUE SE MOCKEA `useIsTouch` Y NO SE SIMULA EL PUNTERO: ese hook decide con
 * `window.matchMedia` DENTRO de un `useEffect`, y `useEffect` **no corre en
 * `renderToStaticMarkup`**. Sin el mock, el render daria SIEMPRE el caso escritorio y la mitad
 * movil de esta spec quedaria verde por no haber mirado, que es peor que no tener test. Los tres
 * componentes de la spec importan el MISMO modulo fisico (`backoffice/catalog/use-is-touch`), asi
 * que un solo `vi.mock` los cubriria a los tres.
 *
 * LO QUE ESTE ARCHIVO **NO** CUBRE, declarado con el intento hecho y no supuesto (`CLAUDE.md`):
 * de las TRES superficies de la spec 0059 aca se pinnea solo la de **producto**.
 *  - **Sello** (`loyalty/steps/step-card-design.tsx`) es alcanzable —solo usa `vm.program`,
 *    `vm.setErrorToast` y `vm.target`—, pero el componente pide un `LoyaltyVm` COMPLETO y armar
 *    el doble exigiria un `as unknown as`, que apaga justamente el typecheck que el doble de
 *    `CatalogImage` de abajo se compra. Queda pendiente, no imposible.
 *  - **Logo** (`brand/brand-page.tsx`) NO se puede por render estatico: carga su estado en un
 *    `useEffect` que no corre en SSR, asi que con `brand === null` devuelve `<BrandSkeleton/>`
 *    (`brand-page.tsx:130`) y el formulario con la camara nunca se emite. **Verificado leyendo el
 *    codigo, no supuesto.** La tecnica que si lo alcanzaria es la de `confirm-dialog-focus.test.ts`
 *    —`vi.mock("react")` sobre los hooks— y esta identificada por si alguien la retoma.
 *
 * El riesgo que queda: el guard `isTouch` de esas dos superficies puede romperse sin que esta
 * suite lo note. Lo que SI esta pinneado es el mecanismo compartido y el cableado de producto.
 */
let touch = false;
vi.mock("./use-is-touch", () => ({ useIsTouch: () => touch }));

import { ProductImageField } from "./product-image-field";
import type { CatalogImage } from "./use-catalog-image";

/**
 * El doble se tipa contra `CatalogImage`, que es el `ReturnType` del hook REAL: si el hook gana
 * un campo, esto deja de compilar en vez de quedar mudo.
 */
function catalogImage(overrides: Partial<CatalogImage> = {}): CatalogImage {
  return {
    selected: null,
    pending: null,
    pendingSrc: null,
    isAnalyzing: false,
    cropped: null,
    stock: null,
    visible: null,
    action: null,
    credit: null,
    choose: vi.fn(),
    applyCrop: vi.fn(),
    cancelCrop: vi.fn(),
    chooseStock: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
    ...overrides,
  } as CatalogImage;
}

function renderProduct(image: CatalogImage = catalogImage()) {
  return parse(
    renderToStaticMarkup(
      createElement(ProductImageField, {
        image,
        name: "imagen",
        onError: () => {},
      }),
    ),
  );
}

describe("spec 0059 — la captura de camara es solo de movil", () => {
  beforeEach(() => {
    touch = false;
  });

  it("en ESCRITORIO no emite ninguna entrada con `capture`", () => {
    const html = renderProduct();

    // El corazon de la spec: `capture` abre la camara del sistema. En escritorio es una entrada
    // rota (o una webcam apuntando a la cara del merchant), y por eso vive dentro de `isTouch`.
    expect(html.querySelectorAll("input[capture]")).toHaveLength(0);
    expect(html.innerText).not.toContain("Tomar foto");
  });

  it("en ESCRITORIO el `accept` es la allow-list compartida, no `image/*`", () => {
    const accept = renderProduct()
      .querySelector("input[type=file]")
      ?.getAttribute("accept");

    // La allow-list sale de `lib/image-formats.ts`, el UNICO lugar donde vive la lista
    // (`CLAUDE.md`). `image/*` en escritorio dejaria pasar formatos que el server rechaza.
    expect(accept).not.toBe("image/*");
    expect(accept).toContain("image/jpeg");
  });

  it("en MOVIL ofrece la camara TRASERA y ademas la galeria", () => {
    touch = true;
    const html = renderProduct();

    const camera = html.querySelectorAll('input[capture="environment"]');
    expect(camera).toHaveLength(1);
    // `environment` es la camara trasera. Con `user` el merchant se fotografia la cara en vez
    // del producto — un bug invisible para un test que solo mire que `capture` existe.
    expect(camera[0]?.getAttribute("capture")).toBe("environment");
    expect(html.innerText).toContain("Tomar foto");

    // Las DOS entradas: la camara se SUMA a la galeria, no la reemplaza.
    expect(
      html.querySelectorAll("input[type=file]").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("en MOVIL el `accept` se abre para no rechazar fotos de Android/iPhone", () => {
    touch = true;

    // Es el bug que este repo ya pago TRES veces (HEIC/HEIF de camara rechazados). En movil el
    // filtro estricto lo aplica el server, no el selector del sistema.
    expect(
      renderProduct().querySelector("input[type=file]")?.getAttribute("accept"),
    ).toBe("image/*");
  });

  it("muestra «Preparando imagen…» SOLO mientras analiza", () => {
    expect(
      renderProduct(catalogImage({ isAnalyzing: true })).innerText,
    ).toContain("Preparando imagen…");

    // El otro lado del bicondicional: sin esta linea, un componente que muestre el cartel
    // SIEMPRE pasaria la asercion de arriba. Es la diferencia entre «aparece» y «aparece
    // cuando debe».
    expect(
      renderProduct(catalogImage({ isAnalyzing: false })).innerText,
    ).not.toContain("Preparando imagen…");
  });

  it("deshabilita TAMBIEN la camara mientras analiza, no solo la galeria", () => {
    touch = true;
    const html = renderProduct(catalogImage({ isAnalyzing: true }));

    // Si la camara quedara viva durante el analisis, el merchant dispara una segunda foto
    // sobre la primera a medio procesar.
    //
    // SE ASEVERA SOBRE EL BOTON, NO SOBRE EL `<input capture>`, y la diferencia importa: ese
    // input es `sr-only` y **no es alcanzable por el usuario** — existe solo para que el boton
    // le haga `.click()`. La primera version de este test pedia `disabled` en el input y daba
    // ROJO con el producto SANO: el rojo era del test, no del codigo. Quien gatea de verdad es
    // el boton.
    const trigger = html
      .querySelectorAll("button")
      .find((el: { innerText: string }) => el.innerText.includes("Tomar foto"));
    expect(trigger).toBeDefined();
    expect(trigger?.getAttribute("disabled")).toBeDefined();
  });
});
