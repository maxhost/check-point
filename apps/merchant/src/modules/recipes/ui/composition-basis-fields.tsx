import { Alert, Button, SelectField, Text, TextField } from "../../../ui";
import { type BasisDraft, basisLabel } from "./composition-basis-draft";

export function CompositionBasisFields({
  value,
  onChange,
  disabled,
}: {
  value: BasisDraft;
  onChange: (value: BasisDraft) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3">
      <Text variant="label">Producto obtenido por esta composición</Text>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Cantidad de producto obtenido"
          inputMode="decimal"
          value={value.basisQuantity}
          onChange={(basisQuantity) => onChange({ ...value, basisQuantity })}
          isDisabled={disabled}
          maxLength={64}
        />
        <SelectField
          label="Unidad del producto obtenido"
          selectedKey={value.basisUnit}
          onSelectionChange={(key) => {
            if (key === "unit" || key === "kg" || key === "lb" || key === "g")
              onChange({ ...value, basisUnit: key });
          }}
          options={[
            { id: "unit", label: "Unidades" },
            { id: "kg", label: "Kilogramos (kg)" },
            { id: "lb", label: "Libras (lb)" },
            { id: "g", label: "Gramos (g)" },
          ]}
          isDisabled={disabled}
        />
      </div>
      <Text variant="small">
        La composición produce {basisLabel(value)} del producto. Cambiar esta
        base no ajusta ingredientes, recetas ni precios. Puedes prepararla antes
        de cambiar el modo de venta en Catálogo.
      </Text>
    </div>
  );
}

export function CompositionReview({
  remote,
  uncertainLibrary,
  busy,
  onConsult,
  onKeep,
}: {
  remote:
    | import("../server/contracts").ProductCompositionDTO
    | import("../server/contracts").LibraryRecipeDTO
    | null;
  uncertainLibrary: boolean;
  busy: boolean;
  onConsult: () => void;
  onKeep: () => void;
}) {
  return (
    <Alert
      kind="warning"
      title="Revisa el estado guardado antes de confirmar otra vez"
    >
      <Text>
        Tu borrador se conserva. No se repetirá el guardado automáticamente.
      </Text>
      {uncertainLibrary && (
        <Text>
          La respuesta de la biblioteca es incierta. Consultaremos la receta por
          su nombre para que revises su identidad antes de continuar.
        </Text>
      )}
      <Button variant="secondary" isDisabled={busy} onPress={onConsult}>
        Consultar estado guardado
      </Button>
      {remote && (
        <div className="grid gap-3">
          <Text>
            {"recipes" in remote
              ? `Base guardada: ${basisLabel(remote)}. Tipo: ${remote.isCombo ? "Combo" : "Catálogo"}. Recetas: ${remote.recipes.map((entry) => `${entry.recipeName} × ${entry.quantity}`).join(", ") || "ninguna"}.`
              : `Receta guardada: ${remote.name}. Ingredientes: ${remote.lines.map((line) => `${line.itemName}: ${line.quantity} ${line.unit}`).join(", ")}.`}
          </Text>
          <Text>
            Compara estos datos con tu borrador. Al continuar mantienes tu
            intención y podrás confirmarla explícitamente.
          </Text>
          <Button variant="secondary" onPress={onKeep}>
            Conservar borrador con la revisión consultada
          </Button>
        </div>
      )}
    </Alert>
  );
}
