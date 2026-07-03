"use client";

// A <form> for a server action that confirms it actually did something. The
// action returns an ActionResult ({ok, message}); we render it as a .flash
// banner above the form so a fire-and-forget op no longer looks like nothing
// happened. Pair with <SubmitButton> for the pending state.

import { useActionState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";

export function ActionFlashForm({
  action,
  children,
  className,
  style,
  id,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string; // lets external inputs join via the HTML form="" attribute (e.g. bulk row checkboxes)
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div>
      {state && (
        <div className={`flash ${state.ok ? "success" : "error"}`} role="status" aria-live="polite">
          {state.message}
        </div>
      )}
      <form id={id} action={formAction} className={className} style={style}>
        {children}
      </form>
    </div>
  );
}
