import { Button } from "../ui";

/** Formulario nativo: el POST lo atiende `api/auth/sign-out` y redirige al login. */
export function SignOutButton() {
  return (
    <form action="/api/auth/sign-out" method="post">
      <Button type="submit" variant="quiet">
        Salir
      </Button>
    </form>
  );
}
