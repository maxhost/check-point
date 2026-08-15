"use client";

import { useState } from "react";
import type { StockPhoto } from "./types";

type Props = {
  onApply: (provider: string, photo: StockPhoto) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

export function StockPicker({ onApply, onClose, onError }: Props) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [selected, setSelected] = useState<StockPhoto | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  async function runSearch(nextPage: number, append: boolean) {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/catalog/stock/search?q=${encodeURIComponent(q)}&page=${nextPage}`,
      );
      const payload = (await res.json().catch(() => null)) as {
        provider?: string;
        photos?: StockPhoto[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "No pudimos buscar imágenes.");
      }
      const batch = Array.isArray(payload?.photos) ? payload!.photos! : [];
      setProvider(payload?.provider ?? "");
      setPhotos((current) => (append ? [...current, ...batch] : batch));
      if (!append) setSelected(null);
      setPage(nextPage);
      setMore(batch.length > 0);
      setSearched(true);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Error de búsqueda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="stock-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca de imágenes"
      >
        <header className="stock-picker-head">
          <h2>Elegir de biblioteca</h2>
          <button
            type="button"
            className="small-button"
            onClick={onClose}
            aria-label="Cerrar biblioteca"
          >
            Cerrar
          </button>
        </header>
        <form
          className="stock-search"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(1, false);
          }}
        >
          <input
            value={query}
            placeholder="Buscar imágenes…"
            aria-label="Buscar imágenes"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="button"
            disabled={loading || !query.trim()}
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>
        <div className="stock-grid">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              className={`stock-cell ${selected?.id === photo.id ? "selected" : ""}`}
              aria-pressed={selected?.id === photo.id}
              onClick={() => setSelected(photo)}
            >
              <img src={photo.thumbUrl} alt={`Foto de ${photo.author}`} />
              <span>{photo.author}</span>
            </button>
          ))}
          {searched && !loading && photos.length === 0 && (
            <p className="field-help">Sin resultados.</p>
          )}
        </div>
        {more && photos.length > 0 && (
          <button
            type="button"
            className="small-button"
            disabled={loading}
            onClick={() => void runSearch(page + 1, true)}
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        )}
        <div className="stock-actions">
          <button type="button" className="button alt" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="button"
            disabled={!selected}
            onClick={() => selected && onApply(provider, selected)}
          >
            Aplicar
          </button>
        </div>
      </section>
    </div>
  );
}
