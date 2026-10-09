import type { TicketDoc } from "../../../printing/index";
import { Heading, Text } from "../../../ui";

/** The browser fallback renders the same document consumed by the printer. */
export function PosPrintTicket({ doc }: { doc: TicketDoc }) {
  return (
    <section
      aria-label="Ticket de impresión"
      className="grid gap-4 print:visible print:absolute print:inset-x-0 print:top-0 print:p-4"
    >
      {doc.businessName !== null && (
        <Heading level={2}>{doc.businessName}</Heading>
      )}
      {doc.table !== null && <Heading level={3}>{doc.table}</Heading>}
      <div className="grid gap-3 border-y border-border py-4">
        {doc.lines.map((line, index) => (
          <div className="flex justify-between gap-4" key={index}>
            <div className="min-w-0 break-words">
              <Text variant="label">{line.name}</Text>
              <Text variant="small">
                {line.quantity} × {line.unitPrice}
              </Text>
            </div>
            <Text>{line.lineTotal}</Text>
          </div>
        ))}
      </div>
      <Text variant="label">Total: {doc.total}</Text>
      <Text variant="small">
        {doc.date} · {doc.time}
      </Text>
    </section>
  );
}
