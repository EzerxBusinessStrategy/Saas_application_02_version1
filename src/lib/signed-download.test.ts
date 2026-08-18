import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openSignedDownloadUrl } from "@/lib/signed-download";

const popup = {
  closed: false,
  opener: window,
  location: { href: "about:blank" },
  close: vi.fn(),
};

beforeEach(() => {
  popup.closed = false;
  popup.opener = window;
  popup.location.href = "about:blank";
  popup.close.mockReset();
  vi.stubGlobal("open", vi.fn(() => popup));
  vi.stubGlobal("location", { assign: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("opens a blank tab synchronously then navigates after the signed URL resolves", async () => {
  await openSignedDownloadUrl(async () => "https://storage.example.com/file.pdf");

  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(popup.opener).toBeNull();
  expect(popup.location.href).toBe("https://storage.example.com/file.pdf");
  expect(popup.close).not.toHaveBeenCalled();
});

test("falls back to same-tab navigation when the popup is blocked", async () => {
  vi.stubGlobal("open", vi.fn(() => null));

  await openSignedDownloadUrl(async () => "https://storage.example.com/file.pdf");

  expect(window.location.assign).toHaveBeenCalledWith("https://storage.example.com/file.pdf");
});

test("closes the blank tab when the signed URL request fails", async () => {
  await expect(
    openSignedDownloadUrl(async () => {
      throw new Error("Download unavailable.");
    }),
  ).rejects.toThrow("Download unavailable.");

  expect(popup.close).toHaveBeenCalled();
});
