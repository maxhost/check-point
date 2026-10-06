import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Upload } from "iconoir-react";
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  ChoiceGroup,
  ColorField,
  Combobox,
  ConfirmDialog,
  DateTimeField,
  Dialog,
  FileButton,
  Form,
  FormActions,
  FormSection,
  Heading,
  Link,
  NumberField,
  PageHeader,
  ProgressBar,
  ProgressIndicator,
  SearchField,
  SegmentedControl,
  SelectField,
  Slider,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextAreaField,
  TextField,
  TimeField,
} from "../../../apps/merchant/src/ui";

/**
 * Spec 0159: todas las piezas del kit en una pagina, dentro del layout del backoffice (donde
 * vive globals.css). Contenido fijo: lo miden ui-kit-checks.ts y las capturas. Las 0160/0161
 * agregan sus piezas al final.
 */
// Layout del harness con estilos inline: Tailwind solo genera las clases que usa apps/merchant.
const column = (gap: number, padding = 0) =>
  ({ display: "grid", gap, padding }) as const;

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";

// Spec 0162: errores del servidor por `name`, sin `errorMessage`. Pagina aparte para no tocar
// las capturas de la pagina del kit.
const serverErrors = (
  <main style={column(20, 24)}>
    <Form
      validationErrors={{
        name: "Nombre tomado",
        category: "Rubro invalido",
        stamps: "Minimo 2 sellos",
        notes: "Notas muy largas",
        plan: "Plan no disponible",
      }}
    >
      <TextField label="Nombre" name="name" />
      <SelectField
        label="Rubro"
        name="category"
        options={[{ id: "food", label: "Gastronomia" }]}
      />
      <NumberField label="Sellos" name="stamps" />
      <TextAreaField label="Notas" name="notes" />
      <ChoiceGroup
        label="Plan"
        name="plan"
        options={[{ value: "free", label: "Gratis" }]}
      />
    </Form>
  </main>
);

// Spec 0160: overlays y navegacion, al final de la pagina por defecto.
const cities = ["Quito", "Cuenca", "Guayaquil", "Loja"].map((city) => ({
  id: city,
  label: city,
}));

function ConfirmExample({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      isOpen={open}
      title="¿Archivar el local?"
      description="Deja de aparecer en el mostrador."
      confirmLabel="Archivar"
      intent="danger"
      tourAnchor="kit-confirm"
      onCancel={onClose}
      onConfirm={onClose}
    />
  );
}

function OverlaysAndNavigation() {
  const [segment, setSegment] = useState<string | number>("name");
  const [notifications, setNotifications] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const items = cities.filter((city) =>
    city.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div style={column(24)}>
      <Tabs>
        <TabList aria-label="Secciones">
          <Tab id="products">Productos</Tab>
          <Tab id="categories">Categorias</Tab>
        </TabList>
        <TabPanel id="products">
          <Text>Panel productos</Text>
        </TabPanel>
        <TabPanel id="categories">
          <Text>Panel categorias</Text>
        </TabPanel>
      </Tabs>
      <SegmentedControl
        aria-label="Buscar por"
        options={[
          { id: "name", label: "Nombre" },
          { id: "phone", label: "Telefono" },
        ]}
        selectedKey={segment}
        onSelectionChange={setSegment}
      />
      <div style={column(8)}>
        <Switch isSelected={notifications} onChange={setNotifications}>
          Notificaciones
        </Switch>
        <Switch isSelected={testMode} onChange={setTestMode}>
          Modo prueba
        </Switch>
      </div>
      <ProgressBar label="Configuracion" value={40} valueLabel="2 de 5" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href="#ayuda">Ver ayuda</Link>
        <Link href="#panel" variant="secondary">
          Ir al panel
        </Link>
      </div>
      <div style={column(8)}>
        <Combobox
          label="Ciudad"
          placeholder="Escribe una ciudad"
          items={items}
          inputValue={query}
          onInputChange={setQuery}
          onSelectionChange={(id) => setChosen(id === null ? null : String(id))}
        />
        <Text variant="small">Elegida: {chosen ?? "ninguna"}</Text>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Button variant="secondary" onPress={() => setDialogOpen(true)}>
          Abrir dialogo
        </Button>
        <Button variant="secondary" onPress={() => setConfirmOpen(true)}>
          Abrir confirmacion
        </Button>
      </div>
      <Dialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Editar nombre"
        description="Lo ven tus clientes."
      >
        <TextField label="Nombre del dialogo" defaultValue="Panaderia" />
      </Dialog>
      <ConfirmExample
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// Spec 0161: campos especiales, al final de la pagina por defecto. «Valor: …» muestra lo ultimo
// que emitio cada pieza: es lo que miden los oraculos.
function Emitted({ value }: { value: string }) {
  return <Text variant="small">Valor: {value}</Text>;
}

function SpecialFields() {
  const [time, setTime] = useState("09:00");
  const [dateTime, setDateTime] = useState("2026-10-15T09:30");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("#176548");
  const [zoom, setZoom] = useState(1);
  const [files, setFiles] = useState("");
  const [photo, setPhoto] = useState("");
  return (
    <div style={column(24)}>
      <div style={column(8)} data-kit="time">
        <TimeField label="Apertura" value={time} onChange={setTime} />
        <Emitted value={time} />
      </div>
      <div style={column(8)} data-kit="date-time">
        <DateTimeField
          label="Inicio de la campaña"
          value={dateTime}
          min="2026-10-05T00:00"
          onChange={setDateTime}
        />
        <Emitted value={dateTime} />
      </div>
      <div style={column(8)} data-kit="search">
        <SearchField
          label="Buscar producto"
          placeholder="Buscar producto…"
          value={search}
          onChange={setSearch}
        />
        <Emitted value={search} />
      </div>
      <div style={column(8)} data-kit="color">
        <ColorField
          label="Color primario"
          value={color}
          onChange={setColor}
          tourAnchor="kit-color"
        />
        <Emitted value={color} />
      </div>
      <div style={column(8)} data-kit="slider">
        <Slider
          label="Zoom"
          minValue={1}
          maxValue={4}
          step={0.5}
          value={zoom}
          onChange={setZoom}
        />
        <Emitted value={String(zoom)} />
      </div>
      <div style={column(8)} data-kit="file">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <FileButton
            icon={<Upload />}
            accept="image/png,image/jpeg"
            inputLabel="Archivo de prueba"
            onSelect={(chosen) =>
              setFiles(chosen.map((file) => file.name).join(", "))
            }
          >
            Subir imagen
          </FileButton>
          <FileButton
            camera
            inputLabel="Foto de prueba"
            onSelect={(chosen) => setPhoto(chosen[0]?.name ?? "")}
          >
            Tomar foto
          </FileButton>
        </div>
        <Emitted value={files} />
        <Text variant="small">Foto: {photo}</Text>
      </div>
    </div>
  );
}

function CalendarCase() {
  const [value, setValue] = useState("2026-10-15T09:30");
  return (
    <main style={column(20, 24)}>
      <DateTimeField
        label="Inicio de la campaña"
        value={value}
        min="2026-10-05T00:00"
        onChange={setValue}
        defaultOpen
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  params.get("case") === "server-errors" ? (
    serverErrors
  ) : params.get("case") === "dialog" ? (
    <ConfirmExample open onClose={() => undefined} />
  ) : params.get("case") === "calendar" ? (
    <CalendarCase />
  ) : (
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
        <OverlaysAndNavigation />
        <SpecialFields />
      </main>
    </div>
  ),
);
