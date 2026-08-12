"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  clearFormDraft,
  readFormDraft,
  writeFormDraft,
  type StoredFormField,
} from "@/lib/client/form-draft-store";

const controlSelector = "input, select, textarea";
const excludedPaths = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
]);

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function formKey(form: HTMLFormElement): string {
  const explicitKey = form.dataset.draftKey;
  if (explicitKey) return `${window.location.pathname}:${explicitKey}`;

  const fallback =
    form.id ||
    form.getAttribute("aria-label") ||
    form.querySelector("button[type=submit]")?.textContent?.trim() ||
    "form";
  const matchingForms = [...document.forms].filter((candidate) => {
    const candidateFallback =
      candidate.dataset.draftKey ||
      candidate.id ||
      candidate.getAttribute("aria-label") ||
      candidate.querySelector("button[type=submit]")?.textContent?.trim() ||
      "form";
    return candidateFallback === fallback;
  });
  return `${window.location.pathname}:${fallback}:${matchingForms.indexOf(form)}`;
}

function controlKey(control: FormControl, index: number): string {
  if (control instanceof HTMLInputElement && control.type === "radio") {
    return `radio:${control.name || index}`;
  }
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    return `checkbox:${control.name || index}:${control.value}`;
  }
  return `field:${control.name || control.id || index}`;
}

function isPersistableControl(control: FormControl): boolean {
  if (control.dataset.draftExclude !== undefined || control.disabled) return false;
  if (!(control instanceof HTMLInputElement)) return true;
  const type = control.type.toLowerCase();
  if (["button", "file", "hidden", "image", "password", "reset", "submit"].includes(type)) {
    return false;
  }
  return !control.autocomplete.toLowerCase().includes("password");
}

function controlsFor(form: HTMLFormElement): FormControl[] {
  return [...form.querySelectorAll<FormControl>(controlSelector)].filter(isPersistableControl);
}

function fieldsFor(form: HTMLFormElement): StoredFormField[] {
  return controlsFor(form).flatMap((control, index) => {
    const key = controlKey(control, index);
    if (control instanceof HTMLInputElement && control.type === "radio") {
      return control.checked ? [{ key, value: control.value, checked: true }] : [];
    }
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      return control.checked ? [{ key, value: control.value, checked: true }] : [];
    }
    return control.value ? [{ key, value: control.value }] : [];
  });
}

function applyStoredValue(control: FormControl, field: StoredFormField): void {
  if (control instanceof HTMLInputElement && control.type === "radio") {
    setNativeChecked(control, field.checked === true && control.value === field.value);
  } else if (control instanceof HTMLInputElement && control.type === "checkbox") {
    setNativeChecked(control, field.checked === true);
  } else {
    setNativeValue(control, field.value);
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeValue(control: FormControl, value: string): void {
  const prototype =
    control instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(control, value);
}

function setNativeChecked(control: HTMLInputElement, checked: boolean): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set?.call(control, checked);
}

export function FormDraftPersistence() {
  useEffect(() => {
    if (excludedPaths.has(window.location.pathname)) return;

    const restored = new WeakSet<HTMLFormElement>();
    const restoredKeys = new Set<string>();
    const timers = new WeakMap<HTMLFormElement, number>();
    let disposed = false;

    const restoreForm = (form: HTMLFormElement) => {
      if (restored.has(form)) return;
      restored.add(form);
      const key = formKey(form);
      const draft = readFormDraft(key);
      if (!draft) return;
      const fields = new Map(draft.fields.map((field) => [field.key, field]));
      controlsFor(form).forEach((control, index) => {
        const field = fields.get(controlKey(control, index));
        if (field) applyStoredValue(control, field);
      });
      if (!restoredKeys.has(key)) {
        restoredKeys.add(key);
        toast.info("Unfinished form draft restored.");
      }
    };

    const restoreForms = () => {
      if (disposed || typeof document === "undefined") return;
      [...document.forms].forEach(restoreForm);
    };

    const saveForm = (form: HTMLFormElement) => {
      window.clearTimeout(timers.get(form));
      timers.set(
        form,
        window.setTimeout(() => writeFormDraft(formKey(form), fieldsFor(form)), 150),
      );
    };

    const onInput = (event: Event) => {
      const control = event.target;
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
      const form = control.form;
      if (form) saveForm(form);
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
      window.clearTimeout(timers.get(form));
      clearFormDraft(formKey(form));
    };

    restoreForms();
    const observer = new MutationObserver(restoreForms);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
