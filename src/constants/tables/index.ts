type ProviderKey = "postgresql" | "mysql" | "sqlite";
type PkTypeValue = "String" | "Int" | "BigInt" | "DateTime" | "Uuid";

export type { ProviderKey, PkTypeValue };

export const pkTypeDetails: Record<
  PkTypeValue,
  { label: string; summary: string; badgeClass: string }
> = {
  String: {
    label: "String (cuid)",
    summary: "App-generated string ID with @default(cuid()).",
    badgeClass: "bg-green-50 text-green-700",
  },
  Int: {
    label: "Int (autoincrement)",
    summary: "Database-generated integer ID.",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  BigInt: {
    label: "BigInt (autoincrement)",
    summary: "Database-generated large integer ID.",
    badgeClass: "bg-rose-50 text-rose-700",
  },
  DateTime: {
    label: "DateTime (now)",
    summary: "Timestamp ID. Use only for legacy schemas.",
    badgeClass: "bg-orange-50 text-orange-700",
  },
  Uuid: {
    label: "Uuid",
    summary: "Provider-aware UUID ID.",
    badgeClass: "bg-purple-50 text-purple-700",
  },
};

export const providerPkTypes: Record<ProviderKey, PkTypeValue[]> = {
  postgresql: ["Int", "BigInt", "Uuid", "String", "DateTime"],
  mysql: ["Int", "BigInt", "Uuid", "String"],
  sqlite: ["Int", "Uuid", "String"],
};

export const defaultPkType = "Int" as const;

export const prismaIdentifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export function providerKey(provider: string): ProviderKey {
  if (provider === "MySQL") return "mysql";
  if (provider === "SQLite") return "sqlite";
  return "postgresql";
}

export function providerLabel(key: ProviderKey): string {
  if (key === "mysql") return "MySQL";
  if (key === "sqlite") return "SQLite";
  return "Postgres";
}

export function pkOptionsForProvider(key: ProviderKey) {
  return providerPkTypes[key].map((value) => ({
    value,
    ...pkTypeDetails[value],
  }));
}

export function pkExampleLine(pkName: string, pkType: string, key: ProviderKey): string {
  const name = prismaIdentifierPattern.test(pkName.trim()) ? pkName.trim() : "id";

  if (pkType === "Int") return `${name} Int @id @default(autoincrement())`;
  if (pkType === "BigInt") return `${name} BigInt @id @default(autoincrement())`;
  if (pkType === "Uuid") {
    return key === "postgresql"
      ? `${name} String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
      : `${name} String @id @default(uuid())`;
  }
  if (pkType === "DateTime") return `${name} DateTime @id @default(now())`;
  return `${name} String @id @default(cuid())`;
}

export function pkTypeBadgeClass(type: string): string {
  return pkTypeDetails[type as PkTypeValue]?.badgeClass ?? "bg-slate-100 text-slate-600";
}
