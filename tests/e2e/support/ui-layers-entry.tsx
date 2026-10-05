import { createRoot } from "react-dom/client";
import { Button } from "../../../apps/merchant/src/ui/button";
import { TextField } from "../../../apps/merchant/src/ui/text-field";

/** Controles del kit dentro del layout del backoffice, donde viven las reglas de globals.css. */
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout">
    <div className="backoffice-content">
      <TextField label="Campo valido" />
      <TextField
        label="Campo invalido"
        isInvalid
        errorMessage="Este campo tiene un error"
      />
      <Button variant="secondary">Secundario</Button>
      <Button>Primario</Button>
    </div>
  </div>,
);
