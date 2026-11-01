import type { TransformFnParams } from 'class-transformer';

/** class-transformer helpers for `@Transform(...)` in DTOs. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const toLowerCaseTrimmed = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Query strings arrive as text: "true" / "1" become true, anything else false. */
export const toBoolean = ({ value }: TransformFnParams): unknown =>
  value === true || value === 'true' || value === '1';
