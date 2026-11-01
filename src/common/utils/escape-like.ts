/**
 * Escapes LIKE/ILIKE wildcards so user input is matched literally:
 * searching for "50%" must not match "500".
 */
export const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);
