import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Dismisses an open panel on a click outside every given element, or on
 * Escape.
 *
 * `alsoOnScroll` is for a panel positioned once when it opens: closing it
 * when the page moves is honest about that, where leaving it pinned to stale
 * coordinates would let it drift away from its anchor.
 */
export function useDismissOnOutside(
  isOpen: boolean,
  refs: RefObject<HTMLElement | null>[],
  onDismiss: () => void,
  alsoOnScroll = false,
): void {
  // Read through a ref so a fresh `refs` array or callback on every render
  // doesn't tear down and rebind the listeners. Kept up to date in its own
  // effect — writing a ref during render is not allowed.
  const latest = useRef({ refs, onDismiss });
  useEffect(() => {
    latest.current = { refs, onDismiss };
  });

  useEffect(() => {
    if (!isOpen) return;

    const dismiss = () => latest.current.onDismiss();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!latest.current.refs.some((ref) => ref.current?.contains(target))) {
        dismiss();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    if (alsoOnScroll) {
      window.addEventListener("scroll", dismiss, true);
      window.addEventListener("resize", dismiss);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (alsoOnScroll) {
        window.removeEventListener("scroll", dismiss, true);
        window.removeEventListener("resize", dismiss);
      }
    };
  }, [isOpen, alsoOnScroll]);
}
