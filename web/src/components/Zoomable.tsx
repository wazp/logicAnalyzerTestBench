import { createContext, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** True inside the full-screen dialog, so a drawing can draw itself larger. */
export const ZoomedContext = createContext(false);

interface Props {
  /** Shown in the dialog header and used for the button labels. */
  title: string;
  /** Drawings wider than tall (waveforms) get a "turn your phone" hint on narrow portrait screens. */
  wide?: boolean;
  children: ComponentChildren;
}

/**
 * A drawing that opens full screen when clicked. The dialog renders the
 * children again rather than scaling a copy, so drawings that measure their
 * container (Waveform) redraw with the extra room, and viewBox SVGs scale up
 * sharp. A native <dialog> gives focus handling and Escape for free.
 */
export function Zoomable({ title, wide, children }: Props) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <div class="zoomable">
      <div class="zoom-target" onClick={() => setOpen(true)}>
        {children}
      </div>
      <button type="button" class="zoom-open" aria-label={`Show larger: ${title}`} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </svg>
      </button>
      {open && (
        <dialog
          ref={dialog}
          class="zoom-dialog"
          aria-label={title}
          onClose={() => setOpen(false)}
          // A click on the dialog element itself (not its content) is a click on the backdrop.
          onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        >
          <div class="zoom-header">
            <span class="zoom-title">{title}</span>
            <button type="button" class="zoom-close" onClick={() => dialog.current?.close()}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
              Close
            </button>
          </div>
          {wide && <p class="zoom-hint">Turn your phone sideways for a wider view.</p>}
          <div class="zoom-body">
            <ZoomedContext.Provider value={true}>{children}</ZoomedContext.Provider>
          </div>
        </dialog>
      )}
    </div>
  );
}
