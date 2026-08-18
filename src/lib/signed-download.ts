/**
 * Opens a signed storage URL in a new tab without losing the user-gesture chain.
 * Browsers block `window.open` when it runs after an async fetch.
 */
export async function openSignedDownloadUrl(getUrl: () => Promise<string>): Promise<void> {
  const popup = window.open("about:blank", "_blank");
  try {
    const url = await getUrl();
    if (popup && !popup.closed) {
      popup.opener = null;
      popup.location.href = url;
      return;
    }
    window.location.assign(url);
  } catch (error) {
    popup?.close();
    throw error;
  }
}
