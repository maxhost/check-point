import type { BusinessModule } from "../settings/module-navigation";
import { permissionOptions, type Permission } from "./staff-contract";

export function PermissionPicker({
  value,
  onChange,
  isOwner,
  disabled = false,
  posEnabled = false,
  modules = [],
  modulesUnavailable = false,
}: {
  value: string[];
  onChange: (permissions: string[]) => void;
  isOwner: boolean;
  disabled?: boolean;
  posEnabled?: boolean;
  modules?: BusinessModule[];
  modulesUnavailable?: boolean;
}) {
  function toggle(permission: Permission, checked: boolean) {
    onChange(
      checked
        ? [...new Set([...value, permission])]
        : value.filter((item) => item !== permission),
    );
  }

  return (
    <fieldset className="staff-permissions" disabled={disabled}>
      <legend>Permisos</legend>
      <p>Un permiso habilita ver, crear y editar ese módulo.</p>
      {permissionOptions(modules)
        .filter((permission) => permission.id !== "pos" || posEnabled)
        .map((permission) => {
          const admin = permission.id === "staff";
          const locked =
            (admin && !isOwner) ||
            !permission.enabled ||
            (modulesUnavailable && permission.modulePermission);
          return (
            <label
              className={admin ? "staff-permission admin" : "staff-permission"}
              data-tour={`staff-permission-${permission.id}`}
              key={permission.id}
            >
              <input
                aria-label={permission.label}
                checked={value.includes(permission.id)}
                disabled={disabled || locked}
                onChange={(event) =>
                  toggle(permission.id, event.target.checked)
                }
                role="switch"
                type="checkbox"
              />
              <span className="staff-switch" aria-hidden="true">
                <i />
              </span>
              <span>
                <strong>{permission.label}</strong>
                <small>
                  {permission.detail}
                  {!permission.enabled
                    ? " Módulo desactivado. Actívalo en Configuración para otorgar este permiso."
                    : ""}
                </small>
                {admin && (
                  <em>
                    Quien lo tenga puede crear a terceros, ver sus PIN y
                    asignarles cualquier permiso.
                    {locked
                      ? " Solo la persona propietaria puede otorgarlo o quitarlo."
                      : " Otórgalo solo a alguien de confianza."}
                  </em>
                )}
              </span>
            </label>
          );
        })}
    </fieldset>
  );
}
