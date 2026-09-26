/** Keep the form and its contextual guide in one keyboard cycle. */
export function catalogTourKeyboard(event: KeyboardEvent, exit: () => void) {
  const popover = document.querySelector<HTMLElement>(".catalog-tour-popover");
  if (!popover) return;
  // Let the open select's own keyboard handler close its listbox first.
  if (document.querySelector('[data-rac][data-placement] [role="listbox"]'))
    return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    exit();
    return;
  }
  if (event.key !== "Tab") return;
  const modal = document.querySelector<HTMLElement>(
    '.staff-modal:has(.catalog-editor), .staff-modal:has(.catalog-ai-modal), .confirm-dialog:has([data-tour="catalog-delete-confirm"])',
  );
  if (!modal) return;
  const selector =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex="0"]';
  const controls = [
    ...modal.querySelectorAll<HTMLElement>(selector),
    ...popover.querySelectorAll<HTMLElement>(selector),
  ].filter(
    (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden",
  );
  if (!controls.length) return;
  const index = controls.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey
    ? index <= 0
      ? controls.length - 1
      : index - 1
    : (index + 1) % controls.length;
  event.preventDefault();
  event.stopImmediatePropagation();
  controls[next].focus();
}
