export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Allowed file types and the extension used when storing them.
 * The type is detected from the file's content (magic numbers), not from its
 * name or the Content-Type the client claims.
 */
export const ALLOWED_ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export const ALLOWED_ATTACHMENT_TYPE_PATTERN = new RegExp(
  `^(${Object.keys(ALLOWED_ATTACHMENT_TYPES)
    .map((type) => type.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('|')})$`,
);
