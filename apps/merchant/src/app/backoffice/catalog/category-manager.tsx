"use client";

import { useState } from "react";
import type { Category } from "./types";

type Props = {
  categories: Category[];
  /** ADR 0086 — con una importacion abierta el alta manual da 409; el boton se apaga.
   * Renombrar y borrar NO se tocan: no compiten con el writer, que es solo aditivo. */
  importInProgress: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (category: Category) => void;
  canDelete: boolean;
};

export function CategoryManager({
  categories,
  importInProgress,
  onCreate,
  onRename,
  onDelete,
  canDelete,
}: Props) {
  const [adding, setAdding] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function create() {
    if (await onCreate(adding.trim())) setAdding("");
  }

  async function rename(id: string) {
    if (await onRename(id, draft.trim())) setEditingId(null);
  }

  return (
    <section className="panel catalog-categories">
      <h2>Categorías</h2>
      <div className="catalog-inline-add">
        <input
          value={adding}
          maxLength={60}
          placeholder="Nueva categoría"
          aria-label="Nueva categoría"
          disabled={importInProgress}
          onChange={(event) => setAdding(event.target.value)}
        />
        <button
          type="button"
          className="small-button"
          disabled={importInProgress || !adding.trim()}
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
        <ul className="catalog-category-list">
          {categories.map((category) => (
            <li key={category.id}>
              {editingId === category.id ? (
                <>
                  <input
                    value={draft}
                    maxLength={60}
                    aria-label={`Renombrar ${category.name}`}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="small-button"
                    disabled={!draft.trim()}
                    onClick={() => void rename(category.id)}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => setEditingId(null)}
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
                    onClick={() => {
                      setEditingId(category.id);
                      setDraft(category.name);
                    }}
                  >
                    Renombrar
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="small-button danger"
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
