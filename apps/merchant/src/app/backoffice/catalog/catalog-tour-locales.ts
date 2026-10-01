import type { CatalogHelpTour, CatalogPhase } from "./catalog-tour-state";

export const CATALOG_HELP: Array<{
  id: CatalogHelpTour;
  title: string;
  body: string;
}> = [
  {
    id: "import-pdf",
    title: "Importar un PDF",
    body: "Convierte tu menú en categorías y productos.",
  },
  {
    id: "import-photos",
    title: "Importar fotos desde el celular",
    body: "Usa la cámara o elige imágenes de tu menú.",
  },
  {
    id: "create-category",
    title: "Crear una categoría",
    body: "Organiza los productos en grupos.",
  },
  {
    id: "create-product",
    title: "Crear un producto",
    body: "Nombre, categoría y datos opcionales.",
  },
  {
    id: "edit-product",
    title: "Editar un producto",
    body: "Actualiza sus datos, imagen y disponibilidad.",
  },
  {
    id: "edit-category",
    title: "Editar una categoría",
    body: "Cambiale el nombre a un grupo.",
  },
  {
    id: "delete-product",
    title: "Eliminar un producto",
    body: "Eliminación permanente con confirmación.",
  },
  {
    id: "delete-category",
    title: "Eliminar una categoría",
    body: "Sus productos quedan sin categoría.",
  },
];

export const CATALOG_PHASE_COPY: Record<
  CatalogPhase,
  readonly [string, string]
> = {
  entry: [
    "Abre el formulario",
    "Toca el control resaltado para empezar. Las acciones de esta guía se aplican a tu catálogo real.",
  ],
  picker: [
    "Elige los archivos",
    "Al elegir un PDF empieza la carga automáticamente y la IA crea lo que falta. Con fotos, elige imágenes legibles del menú completo y sus precios. Buscar archivos reemplaza la selección; cada foto de la cámara se agrega.",
  ],
  analyze: [
    "Analiza las fotos",
    "Cuando hayas elegido todas las fotos, toca Analizar catálogo. La IA creará lo que falta sin modificar tus productos existentes.",
  ],
  processing: [
    "Estamos procesando tu menú",
    "El catálogo se carga automáticamente. Puedes salir de esta guía sin cancelar la importación. Cancelar importación es una acción diferente.",
  ],
  result: [
    "Tu catálogo ya está cargado",
    "Revisa el resumen: lo creado, lo que ya existía, los productos sin precio y las líneas descartadas. Después puedes corregir los datos desde el catálogo. Toca Ver mi catálogo para terminar.",
  ],
  select: [
    "Elige qué quieres gestionar",
    "Toca la acción de la fila que quieres cambiar. Si no encuentras el producto, ajusta los filtros o la búsqueda. La guía seguirá con esa misma entidad.",
  ],
  name: [
    "Completa el nombre",
    "Usa un nombre claro. Este dato es obligatorio; puedes continuar cuando estés listo.",
  ],
  category: [
    "Elige una categoría",
    "Puedes elegir una categoría, dejar el producto sin categoría o crear una sin salir del formulario.",
  ],
  prices: [
    "Precio y costo son opcionales",
    "El precio de venta se usa al vender. El costo es para tus reportes internos. Puedes completar estos datos después.",
  ],
  image: [
    "Imagen del producto",
    "Puedes agregar una imagen o continuar sin cambiarla. La foto del producto es independiente de las fotos del menú que usa el importador.",
  ],
  availability: [
    "Disponibilidad por local",
    "Elige todos los locales o algunos específicos. Si eliges específicos, marca al menos uno. La guía no cambia esta selección por ti.",
  ],
  save: [
    "Guarda los datos",
    "Toca Guardar o Añadir en el formulario. La guía continúa cuando el servidor confirma la operación. Si hay un error, corrígelo e intenta nuevamente.",
  ],
  confirm: [
    "Confirma sólo si quieres eliminar",
    "Revisa el nombre en el diálogo. Esta acción no se puede deshacer. Eliminar una categoría conserva sus productos sin categoría. Cancelar termina la guía sin eliminar nada.",
  ],
  success: [
    "Operación confirmada",
    "El catálogo está actualizado. Puedes volver a Ayuda cuando quieras aprender otra tarea.",
  ],
  refresh: [
    "Los cambios ya se guardaron",
    "Falta actualizar la lista. Toca Reintentar lectura; no volveremos a guardar ni eliminar el elemento.",
  ],
};
