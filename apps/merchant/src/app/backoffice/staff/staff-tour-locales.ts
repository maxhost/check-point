export const STAFF_TOUR_COPY = {
  es: {
    add: ["Añadí un integrante", "Tocá este botón para abrir el formulario."],
    manage: [
      "Gestioná tu equipo",
      "Desde Gestionar podés editar el nombre y los permisos, regenerar el PIN o dar de baja a un integrante.",
    ],
    name: [
      "Completá el nombre",
      "Escribí el nombre con el que identificarás a esta persona.",
    ],
    counter: [
      "Mostrador ya viene activado",
      "Es el permiso recomendado para quien atiende: acreditar compras y canjear premios. Podés apagarlo o sumar otros antes de crear.",
    ],
    create: [
      "Creá y mostrale su PIN",
      "Confirmá el alta. Es una acción real y el PIN aparecerá una sola vez.",
    ],
    copy: [
      "Compartí las credenciales",
      "Copiá el identificador y el PIN. Debés enviárselos vos: no recibe email.",
    ],
    closeCredentials: [
      "Guardá estos datos",
      "Cuando ya los hayas copiado, cerrá este diálogo para continuar.",
    ],
    managePin: [
      "Elegí un integrante",
      "Abrí Gestionar sobre el integrante cuyo PIN querés regenerar.",
    ],
    manageEdit: [
      "Elegí un integrante",
      "Abrí Gestionar para modificar su nombre o sus permisos.",
    ],
    editName: [
      "Editá su nombre",
      "Si cambiás el nombre, también cambiará su identificador de acceso. Tendrás que comunicárselo.",
    ],
    editPermissions: [
      "Modificá sus permisos",
      "Activá o desactivá cada acceso. El cambio reemplaza todos sus permisos actuales.",
    ],
    saveEdit: [
      "Guardá los cambios",
      "Nombre y permisos se guardan por separado y verás el resultado de cada operación.",
    ],
    pin: [
      "Regenerá el PIN",
      "El PIN anterior dejará de funcionar y sus sesiones se cerrarán.",
    ],
    pinConfirm: [
      "Confirmá la regeneración",
      "Esta acción rota el PIN realmente. Confirmala para obtener el nuevo.",
    ],
    manageDisable: [
      "Elegí un integrante",
      "Abrí Gestionar sobre la persona que querés dar de baja.",
    ],
    disable: [
      "Dalo de baja",
      "La baja corta su acceso y es reversible: después podés reactivarlo.",
    ],
    disableConfirm: [
      "Confirmá la baja",
      "La sesión del integrante se cerrará y perderá acceso inmediatamente.",
    ],
  },
} as const;

export type StaffTourLocale = keyof typeof STAFF_TOUR_COPY;
