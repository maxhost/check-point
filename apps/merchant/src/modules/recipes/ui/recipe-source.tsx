"use client";

import { useRef, useState } from "react";
import { Spark } from "iconoir-react";
import {
  Alert,
  Button,
  FileButton,
  Form,
  FormActions,
  Text,
  TextAreaField,
} from "../../../ui";
import { prepareDraftPhotos } from "../../../app/backoffice/draft-photos";
import { panelRequest } from "../../../app/backoffice/panel-request";
import { recipeError, type RecipeDraft } from "./recipe-types";

export function RecipeDraftSource({
  active,
  name,
  productName,
  hasLines,
  busy,
  onDraft,
  onBack,
  onManual,
  onBusyChange,
}: {
  active: boolean;
  name: string;
  productName: string;
  hasLines: boolean;
  busy: boolean;
  onDraft: (draft: RecipeDraft) => void;
  onBack: () => void;
  onManual: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"text" | "photo">("text");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function analyze() {
    if (
      lock.current ||
      busy ||
      !name.trim() ||
      (source === "photo" ? !photos.length : !text.trim())
    )
      return;
    lock.current = true;
    onBusyChange(true);
    setError(null);
    try {
      let draft: RecipeDraft;
      if (source === "photo") {
        const prepared = await prepareDraftPhotos(photos);
        const body = new FormData();
        body.append("name", name.trim());
        for (const photo of prepared) body.append("photos", photo);
        ({ draft } = await panelRequest<{ draft: RecipeDraft }>(
          "/api/modules/recipes/draft-photo",
          "POST",
          body,
        ));
      } else {
        ({ draft } = await panelRequest<{ draft: RecipeDraft }>(
          "/api/modules/recipes/draft",
          "POST",
          { name: name.trim(), text: text.trim() },
        ));
      }
      onDraft(draft);
    } catch (cause) {
      setError(recipeError(cause));
    } finally {
      lock.current = false;
      onBusyChange(false);
    }
  }
  if (!active) return null;
  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        void analyze();
      }}
    >
      {error && <Alert kind="error" title={error} />}
      <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4">
        <Spark aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <Text>
          La IA prepara un borrador. Revisa los ingredientes y sus cantidades en
          el siguiente paso.
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={source === "text" ? "primary" : "secondary"}
          aria-pressed={source === "text"}
          isDisabled={busy}
          onPress={() => {
            setSource("text");
            setError(null);
          }}
        >
          Texto o dictado
        </Button>
        <Button
          variant={source === "photo" ? "primary" : "secondary"}
          aria-pressed={source === "photo"}
          isDisabled={busy}
          onPress={() => {
            setSource("photo");
            setError(null);
          }}
        >
          Fotos
        </Button>
      </div>
      {source === "photo" ? (
        <div className="grid gap-3">
          <Text variant="muted">
            Elige entre 1 y 3 fotos de la receta de {productName}. Puedes usar
            la cámara o elegirlas de tu galería.
          </Text>
          <div className="flex flex-wrap gap-2">
            <FileButton
              accept="image/*"
              multiple
              inputLabel="Fotos de la receta"
              isDisabled={busy}
              onSelect={(files) => {
                if (lock.current) return;
                if (files.length > 3) {
                  setError("Elige entre 1 y 3 fotos.");
                  return;
                }
                setPhotos(files);
                setError(null);
              }}
            >
              {photos.length ? "Cambiar fotos" : "Elegir fotos"}
            </FileButton>
            <FileButton
              accept="image/*"
              camera
              inputLabel="Cámara para receta"
              isDisabled={busy}
              onSelect={(files) => {
                if (lock.current) return;
                if (photos.length + files.length > 3) {
                  setError(
                    "Puedes añadir hasta 3 fotos. Quita una antes de tomar otra.",
                  );
                  return;
                }
                setPhotos((previous) => [...previous, ...files]);
                setError(null);
              }}
            >
              Tomar foto
            </FileButton>
          </div>
          {photos.map((file, index) => (
            <div key={index} className="flex min-w-0 items-center gap-2">
              <Text className="min-w-0 flex-1 break-words">{file.name}</Text>
              <Button
                variant="quiet"
                aria-label={`Quitar foto ${index + 1}`}
                isDisabled={busy}
                onPress={() => {
                  setPhotos((previous) =>
                    previous.filter((_, entry) => entry !== index),
                  );
                  setError(null);
                }}
              >
                Quitar
              </Button>
            </div>
          ))}
          <Text variant="small">
            Máximo 4 MiB por foto y 4,4 MiB en total después de preparar las
            imágenes.
          </Text>
        </div>
      ) : (
        <>
          <TextAreaField
            label="Describe tu receta"
            description="Escribe o usa el micrófono de tu teclado. Menciona los ingredientes, sus cantidades y cuántas unidades de la receta salen."
            placeholder="Para 10 pizzas uso 1 kg de harina, 600 ml de agua, 20 g de sal y 10 g de levadura."
            value={text}
            onChange={setText}
            maxLength={2000}
            isDisabled={busy}
          />
          <Text variant="small">
            {text.length} / 2000 caracteres. Puedes corregir el texto antes de
            analizar.
          </Text>
        </>
      )}
      {busy && (
        <div role="status">
          <Text>
            Analizando {source === "photo" ? "las fotos" : "el texto"}… Puede
            tardar hasta 45 segundos.
          </Text>
        </div>
      )}
      {hasLines && (
        <Text variant="small">
          El borrador analizado reemplazará los ingredientes actuales al
          confirmar.
        </Text>
      )}
      <FormActions>
        <Button variant="secondary" onPress={onBack} isDisabled={busy}>
          Atrás
        </Button>
        <Button
          type="submit"
          isLoading={busy}
          isDisabled={
            busy ||
            !name.trim() ||
            (source === "photo" ? !photos.length : !text.trim())
          }
        >
          Analizar
        </Button>
      </FormActions>
      <div>
        <Button variant="quiet" isDisabled={busy} onPress={onManual}>
          {hasLines ? "Revisar los ingredientes actuales" : "Cargar a mano"}
        </Button>
      </div>
    </Form>
  );
}
