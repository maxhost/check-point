import { createRoot } from "react-dom/client";
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  ChoiceGroup,
  Form,
  FormActions,
  FormSection,
  Heading,
  NumberField,
  PageHeader,
  ProgressIndicator,
  SelectField,
  Text,
  TextAreaField,
  TextField,
} from "../../../apps/merchant/src/ui";

/**
 * Spec 0159: todas las piezas del kit en una pagina, dentro del layout del backoffice (donde
 * vive globals.css). Contenido fijo: lo miden ui-kit-checks.ts y las capturas. Las 0160/0161
 * agregan sus piezas al final.
 */
// Layout del harness con estilos inline: Tailwind solo genera las clases que usa apps/merchant.
const column = (gap: number, padding = 0) =>
  ({ display: "grid", gap, padding }) as const;

const theme = new URLSearchParams(window.location.search).get("theme");
document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";

createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout">
    {/* Ocupa la primera columna del layout de escritorio, como la barra real. */}
    <aside className="backoffice-sidebar" />
    <main className="backoffice-content" style={column(32, 24)}>
      <PageHeader
        title="Kit de CheckPass"
        description="Las piezas del sistema de UI del merchant."
        actions={<Button>Accion</Button>}
      />
      <div style={column(12)}>
        <Heading level={1}>Titulo 1</Heading>
        <Heading level={2}>Titulo 2</Heading>
        <Heading level={3}>Titulo 3</Heading>
        <Text>Texto body</Text>
        <Text variant="muted">Texto muted</Text>
        <Text variant="small">Texto small</Text>
        <Text variant="label">Texto label</Text>
      </div>
      <Card aria-labelledby="kit-card-title">
        <Heading level={2} id="kit-card-title">
          Tarjeta
        </Heading>
        <div style={{ height: 24 }} />
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            event.currentTarget.dataset.submitted = "true";
          }}
        >
          <FormSection
            title="Datos del negocio"
            description="Lo que ven tus clientes"
          >
            <TextField label="Nombre" name="name" isRequired />
            <TextField
              label="Email"
              name="email"
              defaultValue="no-es-un-email"
              errorMessage="Ingresa un email valido"
            />
            <SelectField
              label="Rubro"
              options={[
                { id: "food", label: "Gastronomia" },
                { id: "beauty", label: "Belleza" },
              ]}
            />
            <NumberField label="Sellos" defaultValue={8} />
            <TextAreaField label="Notas" description="Opcional" />
            <CheckboxField
              label="Acepto"
              description="Los terminos."
              isRequired
            />
            <ChoiceGroup
              label="Plan"
              defaultValue="free"
              options={[
                { value: "free", label: "Gratis" },
                { value: "pro", label: "Pro" },
              ]}
            />
          </FormSection>
          <FormActions>
            <Button variant="secondary">Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </FormActions>
        </Form>
      </Card>
      <div style={column(12)}>
        <Alert kind="info" title="Informacion" />
        <Alert kind="success" title="Exito" />
        <Alert kind="warning" title="Advertencia" />
        <Alert kind="error" title="Error">
          Detalle del error.
        </Alert>
      </div>
      <ProgressIndicator
        currentStep={2}
        steps={[
          { label: "Cuenta" },
          { label: "Negocio" },
          { label: "Programa" },
          { label: "Listo" },
        ]}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Button>Primario</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="quiet">Discreto</Button>
        <Button variant="danger">Peligro</Button>
        <Button isLoading>Cargando</Button>
        <Button isDisabled>Deshabilitado</Button>
      </div>
    </main>
  </div>,
);
