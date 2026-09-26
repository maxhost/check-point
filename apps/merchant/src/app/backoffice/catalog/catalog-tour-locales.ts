import type { CatalogHelpTour, CatalogPhase } from "./catalog-tour-state";

export const CATALOG_HELP: Array<{
  id: CatalogHelpTour;
  title: string;
  body: string;
}> = [
  {
    id: "import-pdf",
    title: "Importar un PDF",
    body: "Convertí tu menú en categorías y productos.",
  },
  {
    id: "import-photos",
    title: "Importar fotos desde el celular",
    body: "Usá la cámara o elegí imágenes de tu menú.",
  },
  {
    id: "create-category",
    title: "Crear una categoría",
    body: "Organizá los productos en grupos.",
  },
  {
    id: "create-product",
    title: "Crear un producto",
    body: "Nombre, categoría y datos opcionales.",
  },
  {
    id: "edit-product",
    title: "Editar un producto",
    body: "Actualizá sus datos, imagen y disponibilidad.",
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
    "Abrí el formulario",
    "Tocá el control resaltado para empezar. Las acciones de esta guía se aplican a tu catálogo real.",
  ],
  picker: [
    "Elegí los archivos",
    "Al elegir un PDF empieza la carga automáticamente y la IA crea lo que falta. Con fotos, elegí imágenes legibles del menú completo y sus precios. Buscar archivos reemplaza la selección; cada foto de la cámara se agrega.",
  ],
  analyze: [
    "Analizá las fotos",
    "Cuando hayas elegido todas las fotos, tocá Analizar catálogo. La IA creará lo que falta sin modificar tus productos existentes.",
  ],
  processing: [
    "Estamos procesando tu menú",
    "El catálogo se carga automáticamente. Podés salir de esta guía sin cancelar la importación. Cancelar importación es una acción diferente.",
  ],
  result: [
    "Tu catálogo ya está cargado",
    "Revisá el resumen: lo creado, lo que ya existía, los productos sin precio y las líneas descartadas. Después podés corregir los datos desde el catálogo. Tocá Ver mi catálogo para terminar.",
  ],
  select: [
    "Elegí qué querés gestionar",
    "Tocá la acción de la fila que querés cambiar. Si no encontrás el producto, ajustá los filtros o la búsqueda. La guía seguirá con esa misma entidad.",
  ],
  name: [
    "Completá el nombre",
    "Usá un nombre claro. Este dato es obligatorio; podés continuar cuando estés listo.",
  ],
  category: [
    "Elegí una categoría",
    "Podés elegir una categoría, dejar el producto sin categoría o crear una sin salir del formulario.",
  ],
  prices: [
    "Precio y costo son opcionales",
    "El precio de venta se usa al vender. El costo es para tus reportes internos. Podés completar estos datos después.",
  ],
  image: [
    "Imagen del producto",
    "Podés agregar una imagen o continuar sin cambiarla. La foto del producto es independiente de las fotos del menú que usa el importador.",
  ],
  availability: [
    "Disponibilidad por local",
    "Elegí todos los locales o algunos específicos. Si elegís específicos, marcá al menos uno. La guía no cambia esta selección por vos.",
  ],
  save: [
    "Guardá los datos",
    "Tocá Guardar o Añadir en el formulario. La guía continúa cuando el servidor confirma la operación. Si hay un error, corregilo e intentá nuevamente.",
  ],
  confirm: [
    "Confirmá sólo si querés eliminar",
    "Revisá el nombre en el diálogo. Esta acción no se puede deshacer. Eliminar una categoría conserva sus productos sin categoría. Cancelar termina la guía sin eliminar nada.",
  ],
  success: [
    "Operación confirmada",
    "El catálogo está actualizado. Podés volver a Ayuda cuando quieras aprender otra tarea.",
  ],
  refresh: [
    "Los cambios ya se guardaron",
    "Falta actualizar la lista. Tocá Reintentar lectura; no volveremos a guardar ni eliminar el elemento.",
  ],
};
