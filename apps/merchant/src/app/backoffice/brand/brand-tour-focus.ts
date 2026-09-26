export function brandTourKeyboard(event: KeyboardEvent, exit: () => void) {
  const popover = document.querySelector<HTMLElement>(".brand-tour-popover");
  if (
    !popover ||
    document.querySelector('[data-rac][data-placement] [role="listbox"]')
  )
    return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    exit();
    return;
  }
  if (event.key !== "Tab") return;
  const cropper = document.querySelector<HTMLElement>(
    ".image-cropper, .staff-modal:has(.brand-recovery-actions)",
  );
  if (!cropper) return;
  const selector =
    'button:not([disabled]), input:not([disabled]), [tabindex="0"]';
  const controls = [
    ...cropper.querySelectorAll<HTMLElement>(selector),
    ...popover.querySelectorAll<HTMLElement>(selector),
  ].filter((control) => control.getClientRects().length > 0);
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
