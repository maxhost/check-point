"use client";

import { CheckCircle } from "iconoir-react";
import type { ImportResult } from "./catalog-ai-import-api";

/**
 * EL RESULTADO DE LA IMPORTACION (spec 0091 §9). Reemplaza a la pantalla de revision: el
 * catalogo **ya esta escrito** cuando esto se muestra, asi que no hay nada que confirmar.
 *
 * La operacion es **solo aditiva**: lo que ya existia no se toca, y por eso «reusadas» y
 * «omitidos» se cuentan aparte de «creadas» y «creados» en vez de sumarse.
 */
export function CatalogAiImportResult({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  const reason = (value: string) =>
    value === "unreadable_name" ? "no se entendía el nombre" : "fila inválida";

  return (
    <>
      <div className="catalog-ai-result-head">
        <CheckCircle aria-hidden="true" />
        <div>
          <strong>Catálogo importado</strong>
          <p>
            {result.categoriesCreated} categorías y {result.productsCreated}{" "}
            productos creados.
          </p>
        </div>
      </div>

      <ul className="catalog-ai-result-list">
        {result.categoriesReused > 0 && (
          <li>
            {result.categoriesReused} categorías ya existían y se reutilizaron.
          </li>
        )}
        {result.productsSkipped > 0 && (
          <li>
            {result.productsSkipped} productos ya estaban en su categoría y se
            dejaron como estaban.
          </li>
        )}
        {result.productsWithoutPrice > 0 && (
          <li>
            {result.productsWithoutPrice} productos quedaron{" "}
            <strong>sin precio</strong> porque no pudimos leerlo con seguridad.
            Podés completarlos cuando quieras.
          </li>
        )}
      </ul>

      {result.discardedCount > 0 && (
        <details className="catalog-ai-discarded">
          <summary>
            {result.discardedCount}{" "}
            {result.discardedCount === 1
              ? "línea quedó afuera"
              : "líneas quedaron afuera"}
          </summary>
          <ul>
            {result.discarded.map((item, index) => (
              <li key={`${item.text}-${index}`}>
                {item.text} <small>({reason(item.reason)})</small>
              </li>
            ))}
          </ul>
          {result.discarded.length < result.discardedCount && (
            <p className="field-help">
              Mostramos las primeras {result.discarded.length}. Cargá el resto a
              mano desde el catálogo.
            </p>
          )}
        </details>
      )}

      <div className="catalog-editor-actions">
        <button className="button" type="button" onClick={onClose}>
          Ver mi catálogo
        </button>
      </div>
    </>
  );
}
