"use client";

import { Package } from "iconoir-react";
import {
  forwardRef,
  lazy,
  Suspense,
  type ComponentPropsWithoutRef,
} from "react";

type Icon = typeof Package;
const icons = new Map<string, Icon>();

/** El módulo elige cualquier icono de la biblioteca sin sumar un registro en el core.
 * La biblioteca completa va a un chunk diferido; cada componente conserva su identidad. */
export function moduleIcon(name: string): Icon {
  const cached = icons.get(name);
  if (cached) return cached;
  const LoadedIcon = lazy(async () => {
    const library = await import("iconoir-react");
    const candidate: unknown = library[name as keyof typeof library];
    if (
      candidate &&
      typeof candidate === "object" &&
      "$$typeof" in candidate &&
      candidate.$$typeof === Symbol.for("react.forward_ref")
    ) {
      return { default: candidate as Icon };
    }
    console.warn("module_icon_unavailable", { icon: name });
    return { default: Package };
  });
  const DeferredIcon = forwardRef<
    SVGSVGElement,
    ComponentPropsWithoutRef<Icon>
  >((props, ref) => (
    <Suspense fallback={<Package {...props} />}>
      <LoadedIcon {...props} ref={ref} />
    </Suspense>
  ));
  DeferredIcon.displayName = `ModuleIcon(${name})`;
  icons.set(name, DeferredIcon);
  return DeferredIcon;
}
