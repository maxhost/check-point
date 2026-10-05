import type { ReactNode } from "react";
import { Heading } from "./heading";
import { Text } from "./text";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  headingId?: string;
};

/** Titulo de pagina; en movil las acciones van debajo, desde `sm` a la derecha. */
export function PageHeader({
  title,
  description,
  actions,
  headingId,
}: PageHeaderProps) {
  return (
    <header className="grid gap-4 sm:flex sm:items-start sm:justify-between">
      <div className="grid gap-2">
        <Heading level={1} id={headingId}>
          {title}
        </Heading>
        {description && <Text variant="muted">{description}</Text>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
