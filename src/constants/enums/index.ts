export const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const ENUM_NAME_MAX = 63;
export const ENUM_VALUE_MAX = 63;

export function validateEnumName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enum name is required.";
  if (!identifierPattern.test(v))
    return "Must start with a letter and contain only letters, numbers, or underscores. No spaces, hyphens, or special characters.";
  if (v.length > ENUM_NAME_MAX)
    return `Enum name must be ${ENUM_NAME_MAX} characters or fewer (PostgreSQL limit).`;
  return null;
}

export function validateEnumValue(value: string): string | null {
  const v = value.trim();
  if (!v) return "Value is required.";
  if (!identifierPattern.test(v))
    return "Must start with a letter and contain only letters, numbers, or underscores. No spaces, hyphens, or special characters.";
  if (v.length > ENUM_VALUE_MAX)
    return `Value must be ${ENUM_VALUE_MAX} characters or fewer (PostgreSQL limit).`;
  return null;
}
