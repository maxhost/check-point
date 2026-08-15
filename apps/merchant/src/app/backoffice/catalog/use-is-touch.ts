import { useEffect, useState } from "react";

/**
 * True on touch devices (coarse pointer). Used to give mobile the native
 * camera/gallery file chooser while desktop keeps a strict image filter.
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}
