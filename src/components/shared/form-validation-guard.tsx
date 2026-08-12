"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const controlSelector = "input[required], select[required], textarea[required]";

function isEmptyRequiredControl(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control.disabled || ("readOnly" in control && control.readOnly)) return false;
  if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
    if (control.type === "radio") {
      return ![...document.getElementsByName(control.name)].some((input) => input instanceof HTMLInputElement && input.checked);
    }
    return !control.checked;
  }
  return !control.value.trim();
}

function fieldLabel(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const explicitLabel = control.dataset.fieldLabel;
  if (explicitLabel) return explicitLabel;

  const label = control.id
    ? [...document.querySelectorAll<HTMLLabelElement>("label[for]")].find((item) => item.htmlFor === control.id)
    : control.closest("label");
  const labelText = label?.textContent
    ?.replaceAll("*", "")
    .replace(/\(optional\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return control.getAttribute("aria-label") ?? labelText ?? control.getAttribute("placeholder") ?? "this field";
}

function messageFor(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = fieldLabel(control);
  if (control instanceof HTMLSelectElement || (control instanceof HTMLInputElement && control.type === "radio")) return `Choose ${label}.`;
  if (control instanceof HTMLInputElement && control.type === "checkbox") return `Confirm ${label}.`;
  return `Enter ${label}.`;
}

export function FormValidationGuard() {
  useEffect(() => {
    const clearCustomMessage = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        target.setCustomValidity("");
        target.removeAttribute("aria-invalid");
      }
    };

    const validateRequiredFields = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const control = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(controlSelector)]
        .find(isEmptyRequiredControl);
      if (!control) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const message = messageFor(control);
      control.setCustomValidity(message);
      control.setAttribute("aria-invalid", "true");
      control.reportValidity();
      toast.error(message);
      requestAnimationFrame(() => control.focus());
    };

    document.addEventListener("input", clearCustomMessage, true);
    document.addEventListener("change", clearCustomMessage, true);
    document.addEventListener("submit", validateRequiredFields, true);
    return () => {
      document.removeEventListener("input", clearCustomMessage, true);
      document.removeEventListener("change", clearCustomMessage, true);
      document.removeEventListener("submit", validateRequiredFields, true);
    };
  }, []);

  return null;
}
