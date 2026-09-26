import { useId } from "react";
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import { Button, CheckboxField } from "../../../ui";
import type { CardDesignVm } from "./use-card-design";
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label
        className="cp-field-label text-base font-bold text-content"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="loyalty-color border border-border-strong bg-surface rounded-md text-content">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}
const presets = [
  { label: "Vertical", angle: 180 },
  { label: "Horizontal", angle: 90 },
  { label: "Diagonal ↘", angle: 135 },
  { label: "Diagonal ↗", angle: 45 },
];
export function CardDesignFields({ card }: { card: CardDesignVm }) {
  return (
    <>
      <ColorField
        label="Color de fondo"
        value={card.backgroundColor}
        onChange={card.setBackgroundColor}
      />
      <CheckboxField
        label="Usar degradé (segundo color)"
        isSelected={card.gradientEnabled}
        onChange={card.setGradientEnabled}
      />
      {card.gradientEnabled && (
        <>
          <ColorField
            label="Segundo color"
            value={card.backgroundColor2}
            onChange={card.setBackgroundColor2}
          />
          <Slider
            className="grid gap-3 text-content"
            minValue={0}
            maxValue={360}
            step={15}
            value={card.gradientAngle}
            onChange={(value) => card.setGradientAngle(Number(value))}
          >
            <div className="flex justify-between">
              <Label className="text-base font-bold">
                Dirección del degradé
              </Label>
              <SliderOutput>
                {({ state }) => `${state.getThumbValue(0)}°`}
              </SliderOutput>
            </div>
            <SliderTrack className="relative h-12">
              <div className="absolute top-5 h-2 w-full rounded-full bg-disabled" />
              <SliderThumb className="top-6 size-6 rounded-full bg-primary outline-focus data-[focus-visible]:outline-2" />
            </SliderTrack>
          </Slider>
          <div className="loyalty-actions">
            {presets.map((preset) => (
              <Button
                key={preset.angle}
                variant="secondary"
                aria-pressed={card.gradientAngle === preset.angle}
                onPress={() => card.setGradientAngle(preset.angle)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </>
      )}
      <ColorField
        label="Color del borde de los sellos"
        value={card.borderColor}
        onChange={card.setBorderColor}
      />
    </>
  );
}
