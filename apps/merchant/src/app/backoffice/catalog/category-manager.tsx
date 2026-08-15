"use client";

import { useState } from "react";
import type { Category } from "./types";

type Props = {
  categories: Category[];
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (category: Category) => void;
};

export function CategoryManager({
  categories,
  onCreate,
  onRename,
  onDelete,
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
          onChange={(event) => setAdding(event.target.value)}
        />
        <button
          type="button"
          className="small-button"
          disabled={!adding.trim()}
          onClick={() => void create()}
        >
          Añadir
        </button>
      </div>
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
                  <button
                    type="button"
                    className="small-button danger"
                    onClick={() => onDelete(category)}
                  >
                    Borrar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
