"use client";

// Submit button that shows a pending state while its <form>'s server action
// runs — disables + flips to "Working…" so a slow admin op never looks frozen
// and can't be double-fired. For plain (non-confirm) forms; destructive ones use
// ConfirmButton, which is also pending-aware.

import { useFormStatus } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText = "Working…",
  className,
  variant,
  size,
  style,
  title,
  disabled,
  formAction,
  formNoValidate,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "default" | "secondary";
  size?: "sm" | "default";
  style?: CSSProperties;
  title?: string;
  disabled?: boolean;
  // Override the parent form's action for THIS button (e.g. a "preview" button
  // in a form whose default action does something else). formNoValidate skips
  // the form's HTML required-field checks for this submit.
  formAction?: (formData: FormData) => void | Promise<void>;
  formNoValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className={className}
      variant={variant}
      size={size}
      style={style}
      title={title}
      formAction={formAction}
      formNoValidate={formNoValidate}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
