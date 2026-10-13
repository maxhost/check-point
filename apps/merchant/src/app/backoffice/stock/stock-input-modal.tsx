"use client";

import { useState } from "react";
import {
  EditPencil,
  MediaImage,
  Microphone,
  Page,
  Plus,
  Spark,
  Trash,
} from "iconoir-react";
import {
  Button,
  FileButton,
  Form,
  FormActions,
  Heading,
  Text,
  TextField,
} from "../../../ui";
import { StaffFormModal } from "../staff/staff-form-modal";

type Method = "file" | "voice" | "text";
type Item = { id: string; name: string; quantity: string; price: string };
const blankItem = (id: string): Item => ({
  id,
  name: "",
  quantity: "",
  price: "",
});

/** Propuesta visual: los archivos permanecen locales y no se captura audio. */
export function StockInputModal({
  kind,
  onClose,
  onRegister,
}: {
  kind: "new" | "adjustment";
  onClose: () => void;
  onRegister: (summary: string) => void;
}) {
  const [method, setMethod] = useState<Method>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<Item[]>([blankItem("first")]);
  const valid = items.every(
    (item) => item.name.trim() && item.quantity.trim() && item.price.trim(),
  );
  function change(id: string, field: keyof Omit<Item, "id">, value: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }
  const options = [
    { id: "file" as const, label: "Foto o archivo", icon: MediaImage },
    { id: "voice" as const, label: "Por voz", icon: Microphone },
    { id: "text" as const, label: "Escribir", icon: EditPencil },
  ];

  return (
    <StaffFormModal
      open
      eyebrow="Registro de stock"
      title={kind === "new" ? "Nuevo stock" : "Ajustar stock"}
      description="Elige cómo ingresar los ítems. Podrás revisar la información antes de registrarla."
      onClose={onClose}
    >
      <div className="grid gap-6">
        <div
          role="group"
          aria-label="Forma de ingresar el stock"
          className="grid gap-2 sm:grid-cols-3"
        >
          {options.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={method === id ? "primary" : "secondary"}
              aria-pressed={method === id}
              onPress={() => setMethod(id)}
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Button>
          ))}
        </div>
        {method !== "text" && (
          <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4">
            <Spark
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <Text>
              La IA identificará los ítems, cantidades y precios para que puedas
              revisarlos.
            </Text>
          </div>
        )}
        {method === "file" && (
          <div className="grid gap-4">
            <div className="grid justify-items-center gap-4 rounded-lg border-2 border-dashed border-border-strong bg-surface-subtle px-6 py-8 text-center">
              <MediaImage aria-hidden="true" className="size-10 text-primary" />
              <Heading level={2}>Carga una foto o un archivo</Heading>
              <Text variant="muted">
                Puedes usar fotos de una compra, una factura o una lista de
                insumos con sus cantidades y precios.
              </Text>
              <Text variant="small">Imágenes o PDF</Text>
            </div>
            <FileButton
              accept="image/*,application/pdf"
              multiple
              onSelect={(selected) =>
                setFiles((current) => [...current, ...selected])
              }
              icon={<Page />}
              inputLabel="Archivos de stock"
            >
              Buscar archivos
            </FileButton>
            {files.length > 0 && (
              <div className="grid gap-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-2"
                  >
                    <Text className="min-w-0 break-words">{file.name}</Text>
                    <Button
                      variant="quiet"
                      aria-label={`Quitar ${file.name}`}
                      onPress={() =>
                        setFiles((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <Trash aria-hidden="true" className="size-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <FormActions>
              <Button variant="secondary" onPress={onClose}>
                Cancelar
              </Button>
              <Button isDisabled>Analizar stock</Button>
            </FormActions>
            <Text variant="small">
              Propuesta visual: el análisis con IA todavía no está conectado.
            </Text>
          </div>
        )}
        {method === "voice" && (
          <div className="grid gap-4">
            <div className="grid justify-items-center gap-4 rounded-lg border-2 border-dashed border-border-strong bg-surface-subtle px-6 py-8 text-center">
              <Microphone aria-hidden="true" className="size-10 text-primary" />
              <Heading level={2}>Describe tu stock</Heading>
              <Text variant="muted">
                Menciona el nombre, la cantidad y el precio de cada ítem.
              </Text>
              <Text>
                Por ejemplo: «Harina, dos kilos, tres dólares; huevos, doce
                unidades, cuatro dólares».
              </Text>
              <Button isDisabled>
                <Microphone aria-hidden="true" className="size-5" />
                Empezar a grabar
              </Button>
            </div>
            <FormActions>
              <Button variant="secondary" onPress={onClose}>
                Cancelar
              </Button>
              <Button isDisabled>Analizar audio</Button>
            </FormActions>
            <Text variant="small">
              Propuesta visual: la grabación y el análisis con IA todavía no
              están conectados.
            </Text>
          </div>
        )}
        {method === "text" && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              if (valid)
                onRegister(
                  items
                    .map(
                      (item) =>
                        `${item.name.trim()} · ${item.quantity.trim()} · ${item.price.trim()}`,
                    )
                    .join("; "),
                );
            }}
          >
            <div className="grid gap-2">
              <Heading level={2}>Añade los ítems</Heading>
              <Text variant="muted">
                Escribe el nombre, la cantidad con su unidad y el precio de cada
                ítem.
              </Text>
            </div>
            <div className="grid gap-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-border pb-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Text variant="label">Ítem {index + 1}</Text>
                    {items.length > 1 && (
                      <Button
                        variant="quiet"
                        aria-label={`Quitar ítem ${index + 1}`}
                        onPress={() =>
                          setItems((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        <Trash aria-hidden="true" className="size-5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <TextField
                      label="Nombre"
                      placeholder="Harina"
                      value={item.name}
                      onChange={(value) => change(item.id, "name", value)}
                      className="col-span-2"
                    />
                    <TextField
                      label="Cantidad"
                      placeholder="2 kg"
                      value={item.quantity}
                      onChange={(value) => change(item.id, "quantity", value)}
                    />
                    <TextField
                      label="Precio"
                      placeholder="3,00"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(value) => change(item.id, "price", value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Button
                variant="secondary"
                onPress={() =>
                  setItems((current) => [
                    ...current,
                    blankItem(crypto.randomUUID()),
                  ])
                }
              >
                <Plus aria-hidden="true" className="size-5" />
                Añadir ítem
              </Button>
            </div>
            <FormActions>
              <Button variant="secondary" onPress={onClose}>
                Cancelar
              </Button>
              <Button type="submit" isDisabled={!valid}>
                Añadir a la vista
              </Button>
            </FormActions>
            <Text variant="small">
              Vista de muestra. Los registros se borran al recargar.
            </Text>
          </Form>
        )}
      </div>
    </StaffFormModal>
  );
}
