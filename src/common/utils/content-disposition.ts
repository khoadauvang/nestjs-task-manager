const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Builds a `Content-Disposition: attachment` header that forces a download
 * and keeps non-ASCII file names intact (RFC 6266 / RFC 5987).
 */
export function attachmentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}
