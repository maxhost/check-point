export const STAFF_TOUR_COPY = {
  es: {
    add: ["Añade un integrante", "Toca este botón para abrir el formulario."],
    manage: [
      "Gestiona tu equipo",
      "Desde Gestionar puedes editar el nombre y los permisos, regenerar el PIN o dar de baja a un integrante.",
    ],
    name: [
      "Completa el nombre",
      "Escribe el nombre con el que identificarás a esta persona.",
    ],
    counter: [
      "Mostrador ya viene activado",
      "Es el permiso recomendado para quien atiende: acreditar compras y canjear premios. Puedes apagarlo o sumar otros antes de crear.",
    ],
    create: [
      "Crea su cuenta y muéstrale el PIN",
      "Confirma el alta. Es una acción real y el PIN aparecerá una sola vez.",
    ],
    copy: [
      "Comparte las credenciales",
      "Copia el identificador y el PIN y compártelos con esta persona: no recibirá un email.",
    ],
    closeCredentials: [
      "Guarda estos datos",
      "Cuando ya los hayas copiado, cierra este diálogo para continuar.",
    ],
    managePin: [
      "Elige un integrante",
      "Abre Gestionar sobre el integrante cuyo PIN quieres regenerar.",
    ],
    manageEdit: [
      "Elige un integrante",
      "Abre Gestionar para modificar su nombre o sus permisos.",
    ],
    editName: [
      "Edita su nombre",
      "Si cambias el nombre, también cambiará su identificador de acceso. Tendrás que comunicárselo.",
    ],
    editPermissions: [
      "Modifica sus permisos",
      "Activa o desactiva cada acceso. El cambio reemplaza todos sus permisos actuales.",
    ],
    saveEdit: [
      "Guarda los cambios",
      "Nombre y permisos se guardan por separado y verás el resultado de cada operación.",
    ],
    pin: [
      "Regenera el PIN",
      "El PIN anterior dejará de funcionar y sus sesiones se cerrarán.",
    ],
    pinConfirm: [
      "Confirma la regeneración",
      "Esta acción cambia el PIN. Confírmala para obtener el nuevo.",
    ],
    manageDisable: [
      "Elige un integrante",
      "Abre Gestionar sobre la persona cuyo acceso quieres cambiar.",
    ],
    disable: [
      "Desactiva o restablece su acceso",
      "Este botón alterna: dice «Dar de baja» si está activo y «Reactivar» si ya está de baja. La baja es reversible.",
    ],
    disableConfirm: [
      "Confirma lo que pide el diálogo",
      "Si es una baja, su sesión se cierra y pierde acceso de inmediato; si es una reactivación, lo recupera.",
    ],
  },
} as const;

export type StaffTourLocale = keyof typeof STAFF_TOUR_COPY;
