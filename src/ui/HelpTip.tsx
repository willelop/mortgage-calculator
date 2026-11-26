import React, { useEffect, useRef, useState } from 'react';

/** "?" mark with a tooltip explaining the parameter.
 *  Desktop: hover/focus shows it (CSS, unchanged). Touch and keyboard:
 *  tap/Enter toggles it, Escape or a tap outside closes it, and the
 *  tooltip is exposed via aria-expanded + role="tooltip". Shared by the
 *  parameter form and the Options menu (previously two drifting copies). */
export function HelpTip({ text }: { text: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // return focus to the toggle so keyboard users are not stranded
        rootRef.current?.querySelector<HTMLButtonElement>('.help-mark')?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={'help-tip' + (open ? ' open' : '')}>
      <button
        type="button"
        className="help-mark"
        aria-label={text}
        aria-expanded={open}
        onClick={(e) => {
          // stop the surrounding label/opt-item from toggling
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        ?
      </button>
      <span className="help-tooltip" role="tooltip">{text}</span>
    </span>
  );
}
