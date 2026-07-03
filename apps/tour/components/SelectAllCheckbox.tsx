"use client";

// Header checkbox that checks/unchecks every same-named checkbox in its form.
// Works with checkboxes attached via the HTML form="" attribute (they're in
// form.elements even when not DOM descendants), so row checkboxes can live
// inside a table while the bulk form sits elsewhere on the page.
export function SelectAllCheckbox({ boxName, formId }: { boxName: string; formId?: string }) {
  return (
    <input
      type="checkbox"
      form={formId}
      aria-label="Select all"
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const checked = e.currentTarget.checked;
        for (const el of Array.from(form.elements)) {
          if (el instanceof HTMLInputElement && el.type === "checkbox" && el.name === boxName) el.checked = checked;
        }
      }}
    />
  );
}
