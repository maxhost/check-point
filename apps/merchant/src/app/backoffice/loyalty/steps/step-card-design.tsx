import { useRef } from "react";
import { CardPreview } from "../card-preview";
import type { LoyaltyVm } from "../use-loyalty-program";
import { useIsTouch } from "../../catalog/use-is-touch";
import { ACCEPTED_IMAGE_ACCEPT_ATTR } from "../../../../lib/image-formats";

const ANGLE_PRESETS = [
  { label: "Vertical", angle: 180 },
  { label: "Horizontal", angle: 90 },
  { label: "Diagonal ↘", angle: 135 },
  { label: "Diagonal ↗", angle: 45 },
];

export function StepCardDesign({ vm }: { vm: LoyaltyVm }) {
  const { card, stamp } = vm;
  const stampInput = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouch();
  const stampPreview =
    stamp.preview ??
    (!stamp.removed ? (vm.program?.stampImagePath ?? null) : null);
  return (
    <>
      <h2>Diseño de la tarjeta</h2>
      <div className="card-design-grid">
        <div className="card-design-controls">
          <label className="color-field">
            Color de fondo
            <input
              type="color"
              value={card.backgroundColor}
              onChange={(event) => card.setBackgroundColor(event.target.value)}
            />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={card.gradientEnabled}
              onChange={(event) =>
                card.setGradientEnabled(event.target.checked)
              }
            />
            Usar degradé (segundo color)
          </label>
          {card.gradientEnabled && (
            <>
              <label className="color-field">
                Segundo color
                <input
                  type="color"
                  value={card.backgroundColor2}
                  onChange={(event) =>
                    card.setBackgroundColor2(event.target.value)
                  }
                />
              </label>
              <div className="angle-field">
                <span>Dirección del degradé</span>
                <div className="angle-presets">
                  {ANGLE_PRESETS.map((preset) => (
                    <button
                      key={preset.angle}
                      type="button"
                      className={`chip ${card.gradientAngle === preset.angle ? "selected" : ""}`}
                      onClick={() => card.setGradientAngle(preset.angle)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="15"
                  value={card.gradientAngle}
                  onChange={(event) =>
                    card.setGradientAngle(Number(event.target.value))
                  }
                />
                <span className="field-help">{card.gradientAngle}°</span>
              </div>
            </>
          )}
          <label className="color-field">
            Color del borde de los sellos
            <input
              type="color"
              value={card.borderColor}
              onChange={(event) => card.setBorderColor(event.target.value)}
            />
          </label>
          <div className="stamp-image-field">
            <strong>Imagen del sello</strong>
            {stampPreview && (
              <div className="stamp-image-row">
                <img
                  className="stamp-image-preview"
                  src={stampPreview}
                  alt="Vista previa del sello"
                />
                <button
                  type="button"
                  className="small-button"
                  onClick={() => {
                    stamp.remove();
                    if (stampInput.current) stampInput.current.value = "";
                  }}
                >
                  Quitar
                </button>
              </div>
            )}
            <input
              ref={stampInput}
              type="file"
              accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
              onChange={(event) =>
                stamp.choose(event.target.files?.[0], vm.setErrorToast)
              }
            />
            <p className="field-help">
              PNG, JPEG, WebP, HEIC o AVIF · máximo 5 MB · hasta 2048 × 2048 px.
              Se aplica al guardar.
            </p>
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
    </>
  );
}
