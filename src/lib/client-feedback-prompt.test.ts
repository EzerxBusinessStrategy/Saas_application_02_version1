import { expect, test } from "vitest";
import {
  CLIENT_FEEDBACK_PROMPT_INTERVAL_MS,
  CLIENT_FEEDBACK_PROMPT_SNOOZE_MS,
  canShowClientFeedbackPrompt,
  markClientFeedbackPromptShown,
  markClientFeedbackPromptSnoozed,
  readClientFeedbackPromptState,
  writeClientFeedbackPromptState,
} from "@/lib/client-feedback-prompt";

test("shows pending feedback on the first visit", () => {
  expect(canShowClientFeedbackPrompt({ lastShownAt: null, snoozeUntil: null }, Date.parse("2026-08-19T10:00:00.000Z"))).toBe(
    true,
  );
});

test("waits 24 hours after a prompt was shown", () => {
  const shownAt = Date.parse("2026-08-18T10:00:00.000Z");
  const state = markClientFeedbackPromptShown({ lastShownAt: null, snoozeUntil: null }, shownAt);
  expect(canShowClientFeedbackPrompt(state, shownAt + CLIENT_FEEDBACK_PROMPT_INTERVAL_MS - 1)).toBe(false);
  expect(canShowClientFeedbackPrompt(state, shownAt + CLIENT_FEEDBACK_PROMPT_INTERVAL_MS)).toBe(true);
});

test("hides every popup for 72 hours after skip or close", () => {
  const skippedAt = Date.parse("2026-08-18T10:00:00.000Z");
  const state = markClientFeedbackPromptSnoozed({ lastShownAt: null, snoozeUntil: null }, skippedAt);
  expect(canShowClientFeedbackPrompt(state, skippedAt + CLIENT_FEEDBACK_PROMPT_SNOOZE_MS - 1)).toBe(false);
  expect(canShowClientFeedbackPrompt(state, skippedAt + CLIENT_FEEDBACK_PROMPT_SNOOZE_MS)).toBe(true);
});

test("stores prompt cadence locally", () => {
  window.localStorage.clear();
  expect(readClientFeedbackPromptState()).toEqual({ lastShownAt: null, snoozeUntil: null });
  writeClientFeedbackPromptState({
    lastShownAt: "2026-08-18T10:00:00.000Z",
    snoozeUntil: "2026-08-21T10:00:00.000Z",
  });
  expect(readClientFeedbackPromptState()).toEqual({
    lastShownAt: "2026-08-18T10:00:00.000Z",
    snoozeUntil: "2026-08-21T10:00:00.000Z",
  });
});
