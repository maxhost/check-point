import { Button } from "../../../../ui";
import { CardDesignFields } from "../card-design-fields";
import { useRef } from "react";
import dynamic from "next/dynamic";
import { CardPreview } from "../../../../components/loyalty/card-preview";
import type { LoyaltyVm } from "../use-loyalty-program";
import { useIsTouch } from "../../catalog/use-is-touch";
import { ACCEPTED_IMAGE_ACCEPT_ATTR } from "../../../../lib/image-formats";

// Deferred on purpose: `react-easy-crop` must not ride in the initial bundle of the
// loyalty editor (ADR 0041 §3). `ssr: false` because the cropper is canvas/DOM-only.
const ImageCropper = dynamic(
  () => import("../../../components/image-cropper"),
  { ssr: false },
);

export function StepCardDesign({ vm }: { vm: LoyaltyVm }) {
  const { card, stamp } = vm;
  const stampInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouch();
  const stampPreview =
    stamp.preview ??
    (!stamp.removed ? (vm.program?.stampImagePath ?? null) : null);
  return (
    <>
      <div className="card-design-grid">
        <div className="loyalty-fields">
          <CardDesignFields card={card} />
          <div className="stamp-image-field loyalty-fields">
            <strong>Imagen del sello</strong>
            {stampPreview && (
              <div className="stamp-image-row">
                <img
                  className="stamp-image-preview"
                  src={stampPreview}
                  alt="Vista previa del sello"
                />
                <Button
                  variant="danger"
                  onPress={() => {
                    stamp.remove();
                    if (stampInput.current) stampInput.current.value = "";
                  }}
                >
                  Quitar
                </Button>
              </div>
            )}
            <input
              className="sr-only"
              aria-label="Archivo del sello"
              ref={stampInput}
              type="file"
              accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
              disabled={vm.saving}
              onChange={(event) => {
                void stamp.choose(event.target.files?.[0], vm.setErrorToast);
              }}
            />
            <Button
              variant="secondary"
              isDisabled={vm.saving}
              onPress={() => stampInput.current?.click()}
            >
              {stampPreview ? "Cambiar sello" : "Elegir sello"}
            </Button>
            {isTouch && (
              <>
                <input
                  className="sr-only"
                  aria-label="Foto del sello"
                  ref={cameraInput}
                  type="file"
                  disabled={vm.saving}
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    void stamp.choose(
                      event.target.files?.[0],
                      vm.setErrorToast,
                    );
                  }}
                />
                <Button
                  variant="secondary"
                  isDisabled={vm.saving}
                  onPress={() => cameraInput.current?.click()}
                >
                  Tomar foto
                </Button>
              </>
            )}
            <p className="field-help">
              PNG, JPEG, WebP, HEIC o AVIF · máximo 5 MB · hasta 2048 × 2048 px.
              Se aplica al guardar.
            </p>
            {stamp.isAnalyzing && (
              <Button variant="secondary" onPress={stamp.cancelCrop}>
                Cancelar preparación
              </Button>
            )}
            {stamp.isAnalyzing && (
              <p className="field-help">Preparando imagen…</p>
            )}
          </div>
        </div>
        <div className="card-design-preview">
          <CardPreview
            design={card.payload()}
            target={vm.target}
            stampImagePath={stampPreview}
          />
          <p className="field-help">
            Vista previa con la mitad de los sellos puestos.
          </p>
        </div>
      </div>
      {stamp.pending && stamp.pendingSrc && (
        <ImageCropper
          src={stamp.pendingSrc}
          surface="stamp"
          onDone={stamp.applyCrop}
          onCancel={() => {
            stamp.cancelCrop();
            if (stampInput.current) stampInput.current.value = "";
          }}
        />
      )}
    </>
  );
}
