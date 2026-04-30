/** Max length for per-line return notes (warehouse + customer form + Mongo). */
export const MAX_RETURN_LINE_NOTES = 500;

export function clampReturnLineNotes(input: string | null | undefined): string {
  return String(input ?? "").trim().slice(0, MAX_RETURN_LINE_NOTES);
}
