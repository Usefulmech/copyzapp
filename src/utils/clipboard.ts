/**
 * HTTP-safe clipboard copy utility.
 *
 * navigator.clipboard.writeText() requires a secure context (HTTPS or localhost).
 * When accessing via local network IP over HTTP (e.g. 192.168.x.x), it fails.
 * This function falls back to the legacy execCommand approach for those cases.
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Secure context: use modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback: textarea + execCommand (works over plain HTTP / local network)
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true; // Prevent virtual keyboard from popping up on mobile!
  // Move off-screen so it doesn't flash
  textarea.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, 999999); // Compatibility select for iOS
  try {
    const success = document.execCommand("copy");
    if (!success) throw new Error("execCommand copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * HTTP-safe image copy utility.
 *
 * If in a secure context (HTTPS or localhost) and supported by the browser,
 * it fetches the image, converts non-PNG formats (JPEG/WebP) to PNG using a canvas,
 * and copies the actual image bytes to the clipboard.
 *
 * If the context is insecure (e.g., local Wi-Fi IP on HTTP) or direct binary copy fails,
 * it uses a contenteditable selection fallback to copy the image element as rich-text HTML
 * (so pasting in editors like Discord, Slack, Word, Google Docs works as an image).
 *
 * If all else fails, it copies the absolute URL of the image as text.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<{ type: "image" | "url" }> {
  // Resolve absolute URL
  const absoluteUrl = imageUrl.startsWith("http")
    ? imageUrl
    : window.location.origin + imageUrl;

  // 1. Try modern binary clipboard copy (HTTPS or localhost only)
  if (
    navigator.clipboard &&
    window.isSecureContext &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const response = await fetch(absoluteUrl);
      const blob = await response.blob();

      let pngBlob = blob;

      // Most browsers only support copying image/png to the clipboard.
      // Convert jpeg/webp/etc to png via canvas.
      if (blob.type !== "image/png") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        // Wait for image load
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        ctx.drawImage(img, 0, 0);

        const converted = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png")
        );
        if (!converted) throw new Error("Canvas PNG conversion failed");
        pngBlob = converted;
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);
      return { type: "image" };
    } catch (err) {
      console.warn("Direct binary image copy failed, trying selection fallback:", err);
    }
  }

  // 2. Fallback: Copy via contenteditable selection (works in HTTP / local network)
  // This copies the image as rich-text HTML, letting target rich editors paste the image.
  // Skip contenteditable on mobile devices because it triggers virtual keyboard focus, causing freezes/blackouts
  const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    await copyToClipboard(absoluteUrl);
    return { type: "url" };
  }

  try {
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;user-select:all;";

    const img = document.createElement("img");
    img.src = absoluteUrl;
    img.style.width = "100px";

    div.appendChild(img);
    document.body.appendChild(div);

    const range = document.createRange();
    range.selectNodeContents(div);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const success = document.execCommand("copy");
    document.body.removeChild(div);
    if (selection) {
      selection.removeAllRanges();
    }

    if (success) {
      return { type: "image" };
    }
  } catch (err) {
    console.warn("execCommand image selection copy failed:", err);
  }

  // 3. Final Fallback: Copy absolute URL as text
  await copyToClipboard(absoluteUrl);
  return { type: "url" };
}
