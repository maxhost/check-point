// ADR 0135 §4: el panel usa el kit del comercio desde donde vive, sin moverlo. Este archivo es
// el unico que conoce la ruta; si el kit se muda a `packages/ui`, cambia solo esta linea.
export * from "../../merchant/src/ui";
