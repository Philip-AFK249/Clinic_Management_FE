/**
 * Display-only normalisation of what the rota answers.
 *
 * Kept out of the components so every place that prints a doctor or a room -
 * the dispatcher rows, the booking confirmation, the ticket - reads them the
 * same way, and so `ShiftDispatcherCard` stays a component-only module for
 * fast refresh.
 */

/**
 * The doctor's rank may already be spelled out inside the name the rota
 * carries (`title: "BS.CKI"` + `name: "BS. CKI. Lê Thị Hoàng Yến"`), so the two
 * are only concatenated when the name does not already open with the title -
 * compared without casing, punctuation or accents, which is what makes the
 * `"BS.CKI"` / `"BS. CKI."` spelling difference irrelevant.
 */
export function formatDoctorName(title?: string, name?: string): string {
  const trimmedName = (name ?? "").trim();
  const trimmedTitle = (title ?? "").trim();
  if (!trimmedName) return "";
  if (!trimmedTitle) return trimmedName;
  const comparable = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedTitle = comparable(trimmedTitle);
  if (normalizedTitle && comparable(trimmedName).startsWith(normalizedTitle)) {
    return trimmedName;
  }
  return `${trimmedTitle} ${trimmedName}`.trim();
}

/**
 * Same trap on the room: the rota answers `Phòng 201` or a bare `201`, and the
 * label in front of it is already "Phòng" - only prefix what is missing.
 */
export function formatRoom(room?: string): string {
  const trimmed = (room ?? "").trim();
  if (!trimmed) return "";
  return /^phòng/i.test(trimmed) ? trimmed : `Phòng ${trimmed}`;
}
