const STORAGE_KEY = "saas-app:client-feedback-prompt";

export const CLIENT_FEEDBACK_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const CLIENT_FEEDBACK_PROMPT_SNOOZE_MS = 72 * 60 * 60 * 1000;

export type ClientFeedbackPromptState = {
  lastShownAt: string | null;
  snoozeUntil: string | null;
};

const emptyState: ClientFeedbackPromptState = {
  lastShownAt: null,
  snoozeUntil: null,
};

export function readClientFeedbackPromptState(): ClientFeedbackPromptState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<ClientFeedbackPromptState>;
    return {
      lastShownAt: typeof parsed.lastShownAt === "string" ? parsed.lastShownAt : null,
      snoozeUntil: typeof parsed.snoozeUntil === "string" ? parsed.snoozeUntil : null,
    };
  } catch {
    return emptyState;
  }
}

export function writeClientFeedbackPromptState(state: ClientFeedbackPromptState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Prompt cadence is a local UX hint only.
  }
}

export function canShowClientFeedbackPrompt(
  state: ClientFeedbackPromptState,
  now = Date.now(),
): boolean {
  if (state.snoozeUntil) {
    const snoozeUntil = Date.parse(state.snoozeUntil);
    if (!Number.isNaN(snoozeUntil) && now < snoozeUntil) return false;
  }
  if (state.lastShownAt) {
    const lastShownAt = Date.parse(state.lastShownAt);
    if (!Number.isNaN(lastShownAt) && now < lastShownAt + CLIENT_FEEDBACK_PROMPT_INTERVAL_MS) {
      return false;
    }
  }
  return true;
}

export function markClientFeedbackPromptShown(
  state: ClientFeedbackPromptState,
  now = Date.now(),
): ClientFeedbackPromptState {
  return {
    ...state,
    lastShownAt: new Date(now).toISOString(),
  };
}

export function markClientFeedbackPromptSnoozed(
  state: ClientFeedbackPromptState,
  now = Date.now(),
): ClientFeedbackPromptState {
  return {
    lastShownAt: new Date(now).toISOString(),
    snoozeUntil: new Date(now + CLIENT_FEEDBACK_PROMPT_SNOOZE_MS).toISOString(),
  };
}
