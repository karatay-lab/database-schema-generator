export const MIGRATION_REFERENCE_FIELD = "_referance";
export const MIGRATION_REFERENCES_FIELD = "_referances";

export function normalizeDatabaseIdentifier(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "unnamed"
  );
}

export function toCamelCaseIdentifier(text: string): string {
  const parts = text
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  const camel = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");

  const safe = camel.replace(/^[^a-zA-Z]+/, "");
  return safe || "field";
}

export function isInternalMigrationField(name: string): boolean {
  return name === MIGRATION_REFERENCE_FIELD || name === MIGRATION_REFERENCES_FIELD;
}
