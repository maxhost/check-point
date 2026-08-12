"use client";

import { merchantAuthClient } from "../../lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="text-button"
      onClick={async () => {
        await merchantAuthClient.signOut();
        window.location.assign("/login");
      }}
    >
      Cerrar sesión
    </button>
  );
}
