/** A heading's id: lower case, runs of anything but letters and digits as one dash (the legal pages and the guides share it). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
