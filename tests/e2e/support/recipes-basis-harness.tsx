import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RecipesConsole } from "../../../apps/merchant/src/modules/recipes/ui/recipes-console";
// The host can remove the module during navigation/context replacement, independently of its busy modal.
function Harness() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const leave = () => setVisible(false);
    const enter = () => setVisible(true);
    window.addEventListener("recipes-harness:leave", leave);
    window.addEventListener("recipes-harness:enter", enter);
    return () => {
      window.removeEventListener("recipes-harness:leave", leave);
      window.removeEventListener("recipes-harness:enter", enter);
    };
  }, []);
  return visible ? <RecipesConsole /> : null;
}
createRoot(document.getElementById("root")!).render(<Harness />);
