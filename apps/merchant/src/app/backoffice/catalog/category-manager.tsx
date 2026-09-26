"use client";

import { useState } from "react";
import type { Category } from "./types";
import { useCatalogTour } from "./catalog-tour-context";

type Props = {
  categories: Category[];
  /** ADR 0086 — con una importacion abierta el alta manual da 409; el boton se apaga.
   * Renombrar y borrar NO se tocan: no compiten con el writer, que es solo aditivo. */
  importInProgress: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (category: Category) => void;
  canDelete: boolean;
  actionsDisabled?: boolean;
};

export function CategoryManager({
  categories,
  importInProgress,
  onCreate,
  onRename,
  onDelete,
  canDelete,
  actionsDisabled = false,
}: Props) {
  const [adding, setAdding] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const tour = useCatalogTour();

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      if (await onCreate(adding.trim())) setAdding("");
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (await onRename(id, draft.trim())) setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel catalog-categories">
      <h2>Categorías</h2>
      <div className="catalog-inline-add">
        <input
          data-tour="catalog-category-name"
          value={adding}
          maxLength={60}
          placeholder="Nueva categoría"
          aria-label="Nueva categoría"
          disabled={importInProgress}
          onChange={(event) => setAdding(event.target.value)}
        />
        <button
          type="button"
          data-tour="catalog-category-create"
          className="small-button"
          disabled={importInProgress || busy || !adding.trim()}
          onClick={() => void create()}
        >
          Añadir
        </button>
      </div>
      {importInProgress && (
        <p className="field-help">
          Estamos importando tu menú. Mientras termina no podés crear
          categorías; sí podés renombrar y borrar las que ya están.
        </p>
      )}
      {categories.length === 0 ? (
        <p className="field-help">Sin categorías todavía.</p>
      ) : (
        <ul className="catalog-category-list" data-tour="catalog-category-list">
          {categories.map((category) => (
            <li key={category.id} data-catalog-id={category.id}>
              {editingId === category.id ? (
                <>
                  <input
                    data-tour="catalog-category-edit-name"
                    value={draft}
                    maxLength={60}
                    aria-label={`Renombrar ${category.name}`}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    data-tour="catalog-category-save"
                    className="small-button"
                    disabled={actionsDisabled || busy || !draft.trim()}
                    onClick={() => void rename(category.id)}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    disabled={actionsDisabled || busy}
                    onClick={() => {
                      setEditingId(null);
                      tour?.stop();
                    }}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span>{category.name}</span>
                  <button
                    type="button"
                    className="small-button"
                    disabled={actionsDisabled || busy}
                    onClick={() => {
                      setEditingId(category.id);
                      setDraft(category.name);
                      tour?.notify({ type: "selected", id: category.id });
                    }}
                  >
                    Renombrar
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="small-button danger"
                      disabled={actionsDisabled || busy}
                      onClick={() => onDelete(category)}
                    >
                      Borrar
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
