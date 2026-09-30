/** Replace this adapter with published directory records when the public API exists. */
export type ExploreBusiness = {
  id: string;
  name: string;
  category: "Cafés" | "Restaurantes" | "Tiendas" | "Bienestar";
  area: string;
  description: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  hours: { opens: string; closes: string };
  benefit: string;
};

export const mockBusinesses: ExploreBusiness[] = [
  {
    id: "cafe-del-patio",
    name: "Café del Patio",
    category: "Cafés",
    area: "Centro Histórico",
    description: "Una pausa para conversar, leer o encontrarte con alguien.",
    image: "/images/cafe.jpg",
    imageAlt: "Interior cálido de una cafetería con barra y taburetes",
    imagePosition: "center 58%",
    hours: { opens: "08:00", closes: "20:00" },
    benefit: "8 visitas y tu siguiente café va por la casa",
  },
  {
    id: "mesa-de-barrio",
    name: "Mesa de Barrio",
    category: "Restaurantes",
    area: "El Vergel",
    description: "Una mesa para quedarte un poco más y compartir sin prisa.",
    image: "/images/restaurante.jpg",
    imageAlt: "Mesas preparadas para una cena en un restaurante",
    hours: { opens: "12:00", closes: "22:00" },
    benefit: "Suma puntos con cada comida",
  },
  {
    id: "casa-de-autor",
    name: "Casa de Autor",
    category: "Tiendas",
    area: "San Sebastián",
    description: "Ropa y objetos para encontrar algo especial.",
    image: "/images/tienda.jpg",
    imageAlt: "Interior de una tienda independiente con ropa y accesorios",
    imagePosition: "center 55%",
    hours: { opens: "10:00", closes: "19:00" },
    benefit: "Cada compra te acerca a un regalo",
  },
  {
    id: "ritual-estudio",
    name: "Ritual Estudio",
    category: "Bienestar",
    area: "Remigio Crespo",
    description: "Un espacio para moverte, respirar y regalarte tiempo.",
    image: "/images/bienestar.jpg",
    imageAlt: "Estudio de bienestar luminoso con colchonetas preparadas",
    hours: { opens: "07:00", closes: "20:00" },
    benefit: "Tus clases también suman",
  },
  {
    id: "cafe-de-la-esquina",
    name: "Café de la Esquina",
    category: "Cafés",
    area: "El Batán",
    description: "Café de especialidad para comenzar el día sin apuro.",
    image: "/images/cafe-norte.jpg",
    imageAlt: "Barista preparando café en una cafetería de tonos cálidos",
    imagePosition: "center 48%",
    hours: { opens: "07:30", closes: "18:30" },
    benefit: "Un café de cortesía al completar tus visitas",
  },
  {
    id: "la-mesa-verde",
    name: "La Mesa Verde",
    category: "Restaurantes",
    area: "Puertas del Sol",
    description: "Un rincón luminoso para almorzar y quedarse conversando.",
    image: "/images/restaurante-vergel.jpg",
    imageAlt: "Mesa de madera y plantas en un restaurante luminoso",
    imagePosition: "center 57%",
    hours: { opens: "11:30", closes: "21:00" },
    benefit: "Acumula puntos en cada almuerzo",
  },
  {
    id: "libros-del-barrio",
    name: "Libros del Barrio",
    category: "Tiendas",
    area: "Centro Histórico",
    description: "Estantes para descubrir tu próxima lectura.",
    image: "/images/libreria-barrio.jpg",
    imageAlt: "Estantes con libros de arte y fotografía en una librería",
    hours: { opens: "10:00", closes: "19:00" },
    benefit: "Cada libro suma para tu próxima lectura",
  },
  {
    id: "movimiento-pilates",
    name: "Movimiento Pilates",
    category: "Bienestar",
    area: "Totoracocha",
    description: "Clases para fortalecer el cuerpo y encontrar equilibrio.",
    image: "/images/pilates-centro.jpg",
    imageAlt: "Estudio de pilates con máquinas reformer y luz natural",
    imagePosition: "center 65%",
    hours: { opens: "07:00", closes: "20:30" },
    benefit: "Tus sesiones te acercan a una clase extra",
  },
];
