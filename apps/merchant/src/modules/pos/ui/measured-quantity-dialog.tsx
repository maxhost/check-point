"use client";
import { useRef } from "react";
import {
  Button,
  Dialog,
  FormActions,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import type { MassUnit, MeasureUnit } from "@mi-pasaporte/domain/measures";
import {
  changePresentation,
  editQuantity,
  editorPresentation,
  resolveQuantity,
  unitLabel,
  type QuantityEditor,
} from "./measured-cart-model";

export function MeasuredQuantityDialog({
  name,
  editor,
  enabledUnits,
  error,
  onChange,
  onConfirm,
  onCancel,
}: {
  name: string;
  editor: QuantityEditor;
  enabledUnits: readonly MassUnit[];
  error?: string;
  onChange: (editor: QuantityEditor) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmed = useRef(false);
  const view = editorPresentation(editor);
  let validation = error;
  try {
    resolveQuantity(editor, enabledUnits);
  } catch (cause) {
    validation = (cause as Error).message;
  }
  const units: MeasureUnit[] =
    editor.unit === "unit"
      ? ["unit"]
      : [
          ...new Set([
            ...enabledUnits,
            ...(editor.source?.quantityUnit &&
            editor.source.quantityUnit !== "unit"
              ? [editor.source.quantityUnit]
              : []),
          ]),
        ];
  return (
    <Dialog
      isOpen
      title={`Cantidad de ${name}`}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <div className="grid gap-4">
        <SelectField
          label="Unidad de cantidad"
          options={units.map((id) => ({ id, label: unitLabel(id) }))}
          selectedKey={editor.unit}
          isDisabled={editor.edited || editor.unit === "unit"}
          onSelectionChange={(key) =>
            onChange(changePresentation(editor, key as MeasureUnit))
          }
        />
        <TextField
          autoFocus
          label="Cantidad"
          inputMode={editor.unit === "unit" ? "numeric" : "decimal"}
          value={view.display.replace(".", ",")}
          onChange={(value) => onChange(editQuantity(editor, value))}
          errorMessage={validation}
          description={
            view.approximate
              ? "Aproximación de la cantidad original. Solo escribir una cantidad crea una medición nueva."
              : "Cambiar solo la unidad conserva la cantidad original."
          }
        />
        {editor.source && (
          <Text variant="small">
            Cantidad original: {editor.source.quantity}{" "}
            {unitLabel(editor.source.quantityUnit)}
          </Text>
        )}
        <FormActions>
          <Button variant="secondary" onPress={onCancel}>
            Cancelar
          </Button>
          <Button
            isDisabled={Boolean(validation)}
            onPress={() => {
              if (!confirmed.current) {
                confirmed.current = true;
                onConfirm();
              }
            }}
          >
            Confirmar cantidad
          </Button>
        </FormActions>
      </div>
    </Dialog>
  );
}
