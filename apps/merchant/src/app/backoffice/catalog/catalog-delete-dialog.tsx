"use client";
import { ConfirmDialog } from "../../components/confirm-dialog";
import type { CatalogConfirm } from "./use-catalog-actions";
export function CatalogDeleteDialog({
  confirm,
  busy,
  onCancel,
  onConfirm,
}: {
  confirm: CatalogConfirm | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const category = confirm?.kind === "category";
  const name = confirm
    ? confirm.kind === "category"
      ? confirm.category.name
      : confirm.product.name
    : "";
  return (
    <ConfirmDialog
      open={confirm !== null}
      title={
        category ? `Borrar categoría «${name}»` : `Borrar producto «${name}»`
      }
      description={
        category
          ? "Sus productos quedarán sin categoría. Esta acción no se puede deshacer."
          : "El producto se eliminará del catálogo. Esta acción no se puede deshacer."
      }
      confirmLabel={busy ? "Borrando…" : "Borrar"}
      confirmDisabled={busy}
      confirmTourAnchor="catalog-delete-confirm"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
