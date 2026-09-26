export function loyaltyTourKeyboard(event: KeyboardEvent, exit: () => void) {
  if (!document.querySelector(".loyalty-tour-popover")) return;
  if (document.querySelector('[role="listbox"], [role="menu"]')) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    exit();
  }
}
