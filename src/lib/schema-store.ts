/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSchema } from "@mrleebo/prisma-ast";
import type {
  AttributeArgument,
  Block,
  BlockAttribute,
  Field,
  Model,
  Value,
} from "@mrleebo/prisma-ast";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "@/lib/db/client";
import { registerFsPath } from "@/lib/db/fs-paths";
import { readProjectVersionGraph, replaceNormalizedSchemaFromCanonicalStore } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";

const databaseDirectory = path.join(process.cwd(), "src/database");
const schemasDirectory = path.join(databaseDirectory, "schemas");
const schemaScratchDirectory = path.join(schemasDirectory, ".tmp");
const execFileAsync = promisify(execFile);

const schemaVersion = 1;

function getProjectIdByName(name: string): string | null {
  try {
    const row = db.prepare("SELECT id FROM projects WHERE name = ?").get(name) as { id: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

function toSchemaFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getSchemaFilePath(projectName: string, version: string) {
  return path.join(
    schemasDirectory,
    toSchemaFilePart(projectName),
    `${toSchemaFilePart(version)}.prisma`,
  );
}

export type PrismaModel = {
  key: string;
  name: string;
  pkName: string;
  pkType: string;
};

export type PrismaField = {
  key: string;
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  defaultValue: string;
  comment: string;
  nativeAttribute?: PrismaNativeAttribute;
  updatedAtAttribute?: boolean;
  isId: boolean;
  isRelation: boolean;
  isBackReference: boolean;
  isArray: boolean;
  isEditable: boolean;
};

export type PrismaModelFields = {
  modelKey: string;
  modelName: string;
  fields: PrismaField[];
  enumTypes: string[];
  scalarTypes: string[];
};

export type PrismaRelation = {
  key: string;
  name: string;
  targetModel: string;
  targetModelKey: string;
  backReferenceKey?: string;
  backReferenceName?: string;
  fields: string[];
  references: string[];
  onDelete: string;
  onUpdate: string;
  isArray: boolean;
  nullable: boolean;
  isBackReference: boolean;
  kind: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  preview: string;
};

export type PrismaModelRelations = {
  modelKey: string;
  modelName: string;
  fields: PrismaField[];
  relations: PrismaRelation[];
};

export type PrismaRelationInput = {
  name: string;
  targetModel: string;
  backReferenceName: string;
  fields: string[];
  references: string[];
  onDelete: string;
  onUpdate: string;
  nullable: boolean;
  isArray: boolean;
  backReferenceIsArray: boolean;
};

export type PrismaRestrictionType = "UNIQUE" | "INDEX";

export type PrismaRestriction = {
  key: string;
  type: PrismaRestrictionType;
  fields: string[];
  dbName: string;
  source: "field" | "model";
  preview: string;
};

export type PrismaModelRestrictions = {
  modelKey: string;
  modelName: string;
  fields: PrismaField[];
  restrictions: PrismaRestriction[];
};

export type PrismaFieldInput = {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  defaultValue: string;
  comment: string;
  nativeAttribute?: PrismaNativeAttribute;
  updatedAtAttribute?: boolean;
  isId?: boolean;
};

export type PrismaSchemaTestStep = {
  command: string;
  name: "format" | "validate";
  output: string;
  success: boolean;
};

export type PrismaSchemaTestResult = {
  schemaFile: string;
  steps: PrismaSchemaTestStep[];
  success: boolean;
};

export type PrismaModelSyncResult = {
  fieldCount: number;
  provider: string;
  relationCount: number;
  tableCount: number;
};

export type PrismaNativeAttribute = {
  name: "Uuid" | "VarChar" | "SmallInt" | "Timestamptz";
  args?: string[];
};

type CanonicalConstraint =
  | { type: "PK" }
  | { type: "UNIQUE" }
  | { type: "UPDATED_AT" }
  | ({ type: "NATIVE" } & PrismaNativeAttribute);

type CanonicalRestriction = {
  key: string;
  type: PrismaRestrictionType;
  fields: string[];
  dbName?: string;
  extraArgs?: string[];
};

type CanonicalRelation = {
  name?: string;
  fields: string[];
  references: string[];
  onDelete?: string;
  onUpdate?: string;
};

type CanonicalField = {
  key: string;
  fieldId?: string;
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  comment: string;
  constraints: CanonicalConstraint[];
  array?: boolean;
  relation?: CanonicalRelation;
};

type CanonicalModel = {
  key: string;
  tableId: string;
  name: string;
  fields: CanonicalField[];
  restrictions: CanonicalRestriction[];
};

type CanonicalEnum = {
  name: string;
  values: string[];
};

type CanonicalModelStore = {
  schemaVersion: number;
  projectName: string;
  projectVersion: string;
  provider: string;
  enums?: CanonicalEnum[];
  models: CanonicalModel[];
};

const scalarTypes = [
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Timestamp",
  "Json",
  "Bytes",
];

const logicalToPrismaTypes: Record<string, string> = {
  bigint: "BigInt",
  boolean: "Boolean",
  bytes: "Bytes",
  decimal: "Decimal",
  float: "Float",
  integer: "Int",
  json: "Json",
  string: "String",
  timestamp: "DateTime",
};

const prismaToLogicalTypes: Record<string, string> = {
  BigInt: "bigint",
  Boolean: "boolean",
  Bytes: "bytes",
  DateTime: "timestamp",
  Decimal: "decimal",
  Float: "float",
  Int: "integer",
  Json: "json",
  String: "string",
  Timestamp: "timestamp",
};

function isModelBlock(block: Block): block is Model {
  return block.type === "model";
}

function isEnumBlock(block: Block) {
  return block.type === "enum";
}

function isFieldProperty(property: Model["properties"][number]): property is Field {
  return property.type === "field";
}

function isBlockAttributeProperty(
  property: Model["properties"][number],
): property is BlockAttribute {
  return property.type === "attribute" && property.kind === "object";
}

function findAttribute(field: Field, name: string, group?: string) {
  return field.attributes?.find(
    (attribute) => attribute.name === name && attribute.group === group,
  );
}

function valueToPrisma(value: AttributeArgument["value"] | Value): string {
  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(valueToPrisma).join(", ")}]`;
  }

  if (value.type === "keyValue") {
    return `${value.key}: ${valueToPrisma(value.value)}`;
  }

  if (value.type === "function") {
    return `${value.name}(${(value.params ?? []).map(valueToPrisma).join(", ")})`;
  }

  if (value.type === "array") {
    return `[${(value.args ?? []).map(valueToPrisma).join(", ")}]`;
  }

  if (value.type === "object") {
    return (value.properties ?? []).length
      ? `{ ${(value.properties ?? []).map(valueToPrisma).join(", ")} }`
      : "{}";
  }

  return "";
}

function getDefaultValue(field: Field) {
  const defaultAttribute = findAttribute(field, "default");
  const [defaultArg] = defaultAttribute?.args ?? [];
  return defaultArg ? valueToPrisma(defaultArg.value) : "";
}

function isTimestampField(field: Field) {
  return Boolean(findAttribute(field, "Timestamptz", "db"));
}

function getNativeAttribute(field: Field): PrismaNativeAttribute | undefined {
  const nativeAttribute = field.attributes?.find(
    (attribute) =>
      attribute.group === "db" &&
      ["Uuid", "VarChar", "SmallInt", "Timestamptz"].includes(attribute.name),
  );

  if (!nativeAttribute) {
    return undefined;
  }

  return {
    name: nativeAttribute.name as PrismaNativeAttribute["name"],
    args: nativeAttribute.args?.map((argument) => valueToPrisma(argument.value)),
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(getString).filter(Boolean)
    : [];
}

function getUniqueStringArray(value: unknown) {
  return Array.from(new Set(getStringArray(value)));
}

function normalizeProvider(provider: string) {
  if (provider === "mysql" || provider === "sqlite" || provider === "postgresql") {
    return provider;
  }

  return "postgresql";
}

function getProviderFromPrisma(content: string) {
  const match = content.match(/datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
  return normalizeProvider(match?.[1] ?? "");
}

export function inferPrismaProviderFromContent(content: string) {
  return getProviderFromPrisma(content);
}

function normalizeNativeConstraint(value: unknown): CanonicalConstraint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (getString(record.type) !== "NATIVE") {
    return null;
  }

  const name = getString(record.name);
  if (!["Uuid", "VarChar", "SmallInt", "Timestamptz"].includes(name)) {
    return null;
  }

  return {
    type: "NATIVE",
    name: name as PrismaNativeAttribute["name"],
    args: getStringArray(record.args),
  };
}

function normalizeConstraint(value: unknown): CanonicalConstraint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = getString(record.type);

  if (type === "PK" || type === "UNIQUE" || type === "UPDATED_AT") {
    return { type };
  }

  return normalizeNativeConstraint(value);
}

function normalizeRestriction(value: unknown): CanonicalRestriction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = getString(record.type);
  const fields = getUniqueStringArray(record.fields);

  if ((type !== "UNIQUE" && type !== "INDEX") || fields.length === 0) {
    return null;
  }

  return {
    key: getString(record.key) || randomUUID(),
    type,
    fields,
    dbName: getString(record.dbName),
    extraArgs: getStringArray(record.extraArgs),
  };
}

function normalizeRelation(value: unknown): CanonicalRelation | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    name: getString(record.name),
    fields: getUniqueStringArray(record.fields),
    references: getUniqueStringArray(record.references),
    onDelete: getString(record.onDelete),
    onUpdate: getString(record.onUpdate),
  };
}

function fieldUniqueRestriction(field: CanonicalField): CanonicalRestriction | null {
  if (!field.constraints.some((constraint) => constraint.type === "UNIQUE")) {
    return null;
  }

  return {
    key: randomUUID(),
    type: "UNIQUE",
    fields: [field.key],
  };
}

function restrictionIdentity(restriction: CanonicalRestriction) {
  return `${restriction.type}:${restriction.fields.join("\u0000")}`;
}

function normalizeModelRestrictions(
  fields: CanonicalField[],
  rawRestrictions: unknown,
) {
  const restrictions = Array.isArray(rawRestrictions)
    ? rawRestrictions
        .map(normalizeRestriction)
        .filter((restriction): restriction is CanonicalRestriction =>
          Boolean(restriction),
        )
    : [];
  const legacyRestrictions = fields
    .map(fieldUniqueRestriction)
    .filter((restriction): restriction is CanonicalRestriction =>
      Boolean(restriction),
    );
  const seen = new Set<string>();

  for (const restriction of [...restrictions, ...legacyRestrictions]) {
    const identity = restrictionIdentity(restriction);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
  }

  return [...restrictions, ...legacyRestrictions].filter((restriction) => {
    const identity = restrictionIdentity(restriction);
    if (!seen.has(identity)) {
      return false;
    }

    seen.delete(identity);
    return true;
  });
}

function normalizeField(value: unknown): CanonicalField | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = getString(record.name);
  const type = getString(record.type) || "string";

  if (!name) {
    return null;
  }

  const constraints = Array.isArray(record.constraints)
    ? record.constraints
        .map(normalizeConstraint)
        .filter((constraint): constraint is CanonicalConstraint => Boolean(constraint))
    : [];

  const key = getString(record.key) || randomUUID();
  return {
    key,
    fieldId: getString(record.fieldId) || key,
    name,
    type,
    nullable: getBoolean(record.nullable),
    default: getString(record.default),
    comment: getString(record.comment),
    constraints: constraints.filter((constraint) => constraint.type !== "UNIQUE"),
    array: getBoolean(record.array),
    relation: normalizeRelation(record.relation),
  };
}

function normalizeModel(value: unknown): CanonicalModel | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = getString(record.name);

  if (!name) {
    return null;
  }

  const fields = Array.isArray(record.fields)
    ? record.fields
        .map(normalizeField)
        .filter((field): field is CanonicalField => Boolean(field))
    : [];

  return {
    key: getString(record.key) || randomUUID(),
    tableId: getString(record.tableId) || randomUUID(),
    name,
    fields,
    restrictions: normalizeModelRestrictions(fields, record.restrictions),
  };
}

function normalizeEnum(value: unknown): CanonicalEnum | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = getString(record.name);
  const values = getStringArray(record.values);

  if (!name || values.length === 0) {
    return null;
  }

  return { name, values };
}

function normalizeStore(
  value: unknown,
  projectName: string,
  version: string,
): CanonicalModelStore {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    schemaVersion: schemaVersion,
    projectName,
    projectVersion: version,
    provider: normalizeProvider(getString(record.provider)),
    enums: Array.isArray(record.enums)
      ? record.enums
          .map(normalizeEnum)
          .filter((item): item is CanonicalEnum => Boolean(item))
      : [],
    models: Array.isArray(record.models)
      ? record.models
          .map(normalizeModel)
          .filter((model): model is CanonicalModel => Boolean(model))
      : [],
  };
}

function assertValidIdentifier(name: string, label: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`${label} must start with a letter and contain only letters, numbers, and underscores.`);
  }
}

function assertValidFieldType(type: string, store: CanonicalModelStore) {
  const enumTypes = store.enums?.map((item) => item.name) ?? [];

  if (!scalarTypes.includes(type) && !enumTypes.includes(type)) {
    throw new Error("Field type must be a supported scalar or existing enum.");
  }
}

function uiTypeToLogicalType(type: string) {
  const trimmed = type.trim();
  return prismaToLogicalTypes[trimmed] ?? trimmed;
}

function logicalTypeToPrismaType(type: string) {
  return logicalToPrismaTypes[type] ?? type;
}

function nativeConstraint(field: CanonicalField): PrismaNativeAttribute | undefined {
  return field.constraints.find(
    (constraint): constraint is CanonicalConstraint & PrismaNativeAttribute =>
      constraint.type === "NATIVE",
  );
}

function canonicalFieldToUiField(
  field: CanonicalField,
  modelNames: string[],
  enumTypes: string[],
  restrictions: CanonicalRestriction[] = [],
  modelKeyToName: Map<string, string> = new Map(),
): PrismaField {
  const nativeAttribute = nativeConstraint(field);
  const isRelation = !!field.relation;
  const resolvedType = isRelation
    ? (modelKeyToName.get(field.type) ?? field.type)
    : logicalTypeToPrismaType(field.type);
  const isArray = Boolean(field.array);
  const isEditable =
    !isRelation &&
    !isArray &&
    (scalarTypes.includes(
      field.type === "timestamp" && nativeAttribute?.name === "Timestamptz"
        ? "Timestamp"
        : resolvedType,
    ) ||
      enumTypes.includes(field.type));
  const type =
    !isRelation && field.type === "timestamp" && nativeAttribute?.name === "Timestamptz"
      ? "Timestamp"
      : resolvedType;

  return {
    key: field.key,
    name: field.name,
    type,
    nullable: field.nullable,
    unique: restrictions.some(
      (restriction) =>
        restriction.type === "UNIQUE" &&
        restriction.fields.length === 1 &&
        restriction.fields[0] === field.key,
    ),
    defaultValue: field.default,
    comment: field.comment,
    nativeAttribute,
    updatedAtAttribute: field.constraints.some(
      (constraint) => constraint.type === "UPDATED_AT",
    ),
    isId: field.constraints.some((constraint) => constraint.type === "PK"),
    isRelation,
    isBackReference: isRelation && (field.relation?.fields.length ?? 0) === 0,
    isArray,
    isEditable,
  };
}

function getPrimaryKey(model: CanonicalModel) {
  return model.fields.find((field) =>
    field.constraints.some((constraint) => constraint.type === "PK"),
  );
}

function getPkType(field: CanonicalField | undefined) {
  if (!field) {
    return "String";
  }

  const native = nativeConstraint(field);
  if (field.type === "string" && native?.name === "Uuid") {
    return "Uuid";
  }

  const prismaType = logicalTypeToPrismaType(field.type);
  return prismaType === "DateTime" ? "DateTime" : prismaType;
}

const KNOWN_DEFAULT_FNS = /^(?:autoincrement|uuid|cuid|now|dbgenerated)\s*\([\s\S]*\)$/;
const LITERAL_DEFAULT = /^(?:true|false|-?\d+(?:\.\d+)?|"[^"]*")$/;

function storeDefaultValue(defaultValue: string): string {
  const trimmed = defaultValue.trim();
  if (!trimmed) return "";
  if (!LITERAL_DEFAULT.test(trimmed) && !KNOWN_DEFAULT_FNS.test(trimmed)) {
    throw new Error(
      `Invalid default value "${trimmed}". Use a literal (true, false, number, "string") or a supported function (autoincrement(), uuid(), cuid(), now(), dbgenerated("...")).`,
    );
  }
  return trimmed;
}

function fieldInputToCanonical(
  input: PrismaFieldInput,
  store: CanonicalModelStore,
  key: string = randomUUID(),
  fieldId: string = randomUUID(),
): CanonicalField {
  const name = input.name.trim();
  const uiType = input.type.trim();
  const logicalType = uiTypeToLogicalType(uiType);
  const constraints: CanonicalConstraint[] = [];

  assertValidIdentifier(name, "Field name");
  assertValidFieldType(uiType, store);

  if (input.isId) {
    constraints.push({ type: "PK" });
  }

  if (input.updatedAtAttribute) {
    constraints.push({ type: "UPDATED_AT" });
  }

  if (input.nativeAttribute) {
    constraints.push({ type: "NATIVE", ...input.nativeAttribute });
  } else if (uiType === "Timestamp") {
    constraints.push({ type: "NATIVE", name: "Timestamptz", args: ["6"] });
  }

  return {
    key,
    fieldId,
    name,
    type: logicalType,
    nullable: Boolean(input.nullable),
    default: storeDefaultValue(input.defaultValue),
    comment: input.comment.trim(),
    constraints,
  };
}

function assertModelExists(store: CanonicalModelStore, modelName: string) {
  if (!store.models.some((model) => model.name === modelName)) {
    throw new Error("Target table was not found in the selected schema.");
  }
}

// Resolve a relation field's type (may be a model UUID key or a legacy model name) to the model's display name.
function resolveRelationTypeName(type: string, store: CanonicalModelStore): string {
  const m = store.models.find((m) => m.key === type) ?? store.models.find((m) => m.name === type);
  return m?.name ?? type;
}

// Find a model by relation field type — handles both new UUID key format and legacy name format.
function findModelByRelationType(type: string, store: CanonicalModelStore): CanonicalModel | undefined {
  return store.models.find((m) => m.key === type) ?? store.models.find((m) => m.name === type);
}

function defaultBackReferenceName(modelName: string) {
  return modelName ? `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}` : "";
}

function relationNameForField(field: CanonicalField) {
  return field.relation?.name?.trim() ?? "";
}

function isBackReferenceField(
  field: CanonicalField,
  sourceModel: CanonicalModel,
  relationName: string,
) {
  return (
    (field.type === sourceModel.key || field.type === sourceModel.name) &&
    relationNameForField(field) === relationName &&
    (field.relation?.fields ?? []).length === 0 &&
    (field.relation?.references ?? []).length === 0
  );
}

function findBackReferenceField(
  store: CanonicalModelStore,
  sourceModel: CanonicalModel,
  owningField: CanonicalField,
) {
  const targetModel = findModelByRelationType(owningField.type, store);
  if (!targetModel) return null;

  const relationName = relationNameForField(owningField);

  // Primary: match by stored relation name (exact, fast)
  if (relationName) {
    const fieldIndex = targetModel.fields.findIndex((field) =>
      isBackReferenceField(field, sourceModel, relationName),
    );
    if (fieldIndex !== -1) {
      return { field: targetModel.fields[fieldIndex], fieldIndex, model: targetModel };
    }
  }

  // Fallback: find any back-reference from target to source (handles name mismatches and old data)
  const candidates = targetModel.fields
    .map((field, fieldIndex) => ({ field, fieldIndex }))
    .filter(({ field }) =>
      (field.type === sourceModel.key || field.type === sourceModel.name) &&
      (field.relation?.fields ?? []).length === 0 &&
      (field.relation?.references ?? []).length === 0,
    );

  if (candidates.length === 1) {
    return { field: candidates[0].field, fieldIndex: candidates[0].fieldIndex, model: targetModel };
  }

  return null;
}

function copyRelationScalarConstraints(field: CanonicalField): CanonicalConstraint[] {
  return field.constraints
    .filter(
      (constraint): constraint is CanonicalConstraint & PrismaNativeAttribute =>
        constraint.type === "NATIVE",
    )
    .map((constraint) => ({ ...constraint }));
}

function ensureRelationScalarFields(
  model: CanonicalModel,
  targetModel: CanonicalModel,
  fields: string[],
  references: string[],
  nullable: boolean,
) {
  if (fields.length === 0 || references.length === 0) {
    throw new Error("Local relation field and referenced field are required.");
  }

  fields.forEach((fieldName, index) => {
    assertValidIdentifier(fieldName, "Local relation field");

    const referenceName = references[index];
    const referenceField = targetModel.fields.find(
      (field) => field.name === referenceName,
    );

    if (!referenceField) {
      throw new Error(`Referenced field ${referenceName} was not found in the target model.`);
    }

    const existingField = model.fields.find((field) => field.name === fieldName);

    if (existingField) {
      if (existingField.relation || existingField.array) {
        throw new Error("Local relation field must be a scalar field.");
      }

      if (existingField.type !== referenceField.type) {
        throw new Error("Local relation field type must match the referenced field type.");
      }

      return;
    }

    const scalarKey = randomUUID();
    model.fields.push({
      key: scalarKey,
      fieldId: scalarKey,
      name: fieldName,
      type: referenceField.type,
      nullable,
      default: "",
      comment: "",
      constraints: copyRelationScalarConstraints(referenceField),
      array: false,
    });
  });
}

function generateRelationName(sourceName: string, fieldName: string, targetName: string): string {
  return `${sourceName}_${fieldName}_${targetName}_rl`;
}

function relationInputToCanonicalField(
  input: PrismaRelationInput,
  store: CanonicalModelStore,
  model: CanonicalModel,
  key: string = randomUUID(),
): CanonicalField {
  const name = input.name.trim();
  const targetModelName = input.targetModel.trim();
  const targetModel = store.models.find((item) => item.name === targetModelName);
  const fields = getUniqueStringArray(input.fields);
  const references = getUniqueStringArray(input.references);
  const relationName = generateRelationName(model.name, name, targetModelName);

  assertValidIdentifier(name, "Relation field name");
  assertModelExists(store, targetModelName);

  if (fields.length !== references.length) {
    throw new Error("Relation fields and references must have the same length.");
  }

  if (!targetModel) {
    throw new Error("Target table was not found in the selected schema.");
  }

  ensureRelationScalarFields(
    model,
    targetModel,
    fields,
    references,
    Boolean(input.nullable),
  );

  // After ensureRelationScalarFields, the scalar fields exist in model.fields.
  // Resolve field names to keys for storage.
  const localFieldKeys = fields.map(
    (name) => model.fields.find((f) => !f.relation && f.name === name)?.key ?? name,
  );
  const refFieldKeys = references.map(
    (name) => targetModel.fields.find((f) => !f.relation && f.name === name)?.key ?? name,
  );

  return {
    key,
    name,
    type: targetModel.key,
    nullable: Boolean(input.nullable),
    default: "",
    comment: "",
    constraints: [],
    array: Boolean(input.isArray),
    relation: {
      name: relationName,
      fields: localFieldKeys,
      references: refFieldKeys,
      onDelete: input.onDelete.trim(),
      onUpdate: input.onUpdate.trim(),
    },
  };
}

function relationInputToBackReferenceField(
  input: PrismaRelationInput,
  sourceModel: CanonicalModel,
  relName: string,
  key: string = randomUUID(),
): CanonicalField {
  const name =
    input.backReferenceName.trim() || defaultBackReferenceName(sourceModel.name);

  assertValidIdentifier(name, "Back reference field name");

  return {
    key,
    name,
    type: sourceModel.key,
    nullable: !input.backReferenceIsArray,
    default: "",
    comment: "",
    constraints: [],
    array: Boolean(input.backReferenceIsArray),
    relation: {
      name: relName,
      fields: [],
      references: [],
      onDelete: "",
      onUpdate: "",
    },
  };
}

function pkFieldInput(pkName: string, pkType: string, provider = "postgresql"): PrismaFieldInput {
  const trimmedType = pkType.trim();
  const normalizedProvider = normalizeProvider(provider);
  const input: PrismaFieldInput = {
    name: pkName.trim() || "id",
    type: trimmedType === "Uuid" ? "String" : trimmedType,
    nullable: false,
    unique: false,
    defaultValue: "",
    comment: "",
    isId: true,
  };

  if (trimmedType === "Int") {
    input.defaultValue = "autoincrement()";
  } else if (trimmedType === "BigInt") {
    input.defaultValue = "autoincrement()";
  } else if (trimmedType === "String") {
    input.defaultValue = "cuid()";
  } else if (trimmedType === "Uuid") {
    if (normalizedProvider === "postgresql") {
      input.defaultValue = `dbgenerated("gen_random_uuid()")`;
      input.nativeAttribute = { name: "Uuid" };
    } else {
      input.defaultValue = "uuid()";
    }
  } else if (trimmedType === "DateTime") {
    input.defaultValue = "now()";
    if (normalizedProvider === "postgresql") {
      input.nativeAttribute = { name: "Timestamptz", args: ["6"] };
    }
  }

  return input;
}

function writeModelStore(store: CanonicalModelStore) {
  const projectId = getProjectIdByName(store.projectName);
  if (!projectId) return;
  db.prepare(`
    INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(projectId, store.projectVersion, JSON.stringify(store), new Date().toISOString());
  replaceNormalizedSchemaFromCanonicalStore(
    store.projectName,
    store.projectVersion,
    store,
  );
}

function resolveRelationFieldNames(fieldKeys: string[], sourceModel: CanonicalModel): string[] {
  return fieldKeys.map((keyOrName) => sourceModel.fields.find((f) => f.key === keyOrName)?.name ?? keyOrName);
}

function renderRelationAttribute(
  relation: CanonicalRelation | undefined,
  sourceModel?: CanonicalModel,
  targetModel?: CanonicalModel,
) {
  if (!relation) {
    return "";
  }

  const fieldNames = sourceModel ? resolveRelationFieldNames(relation.fields, sourceModel) : relation.fields;
  const referenceNames = targetModel ? resolveRelationFieldNames(relation.references, targetModel) : relation.references;

  const args = [
    relation.name ? quotedPrismaString(relation.name) : "",
    fieldNames.length ? `fields: [${fieldNames.join(", ")}]` : "",
    referenceNames.length
      ? `references: [${referenceNames.join(", ")}]`
      : "",
    relation.onDelete ? `onDelete: ${relation.onDelete}` : "",
    relation.onUpdate ? `onUpdate: ${relation.onUpdate}` : "",
  ].filter(Boolean);

  return args.length ? `@relation(${args.join(", ")})` : "@relation";
}

function quotedPrismaString(value: string) {
  return JSON.stringify(value);
}

function renderRestrictionDbName(restriction: CanonicalRestriction) {
  return restriction.dbName ? [`map: ${quotedPrismaString(restriction.dbName)}`] : [];
}

function renderFieldUniqueAttribute(restriction: CanonicalRestriction | undefined) {
  if (!restriction) {
    return "";
  }

  const args = renderRestrictionDbName(restriction);
  return args.length ? `@unique(${args.join(", ")})` : "@unique";
}

function renderBlockRestriction(restriction: CanonicalRestriction, model?: CanonicalModel) {
  const fieldNames = model ? resolveRestrictionFieldNames(restriction, model) : restriction.fields;

  if (restriction.type === "UNIQUE" && fieldNames.length === 1) {
    return "";
  }

  const name = restriction.type === "UNIQUE" ? "unique" : "index";
  const args = [
    `[${fieldNames.join(", ")}]`,
    ...renderRestrictionDbName(restriction),
    ...(restriction.extraArgs ?? []),
  ];

  return `  @@${name}(${args.join(", ")})`;
}

function unquotePrismaString(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function attributeDbName(attribute: { args?: AttributeArgument[] }) {
  const dbNameArg = attribute.args?.find((argument) => {
    const value = argument.value;
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.type === "keyValue" &&
      (value.key === "map" || value.key === "name")
    );
  });

  if (
    !dbNameArg ||
    !dbNameArg.value ||
    typeof dbNameArg.value !== "object" ||
    Array.isArray(dbNameArg.value)
  ) {
    return "";
  }

  const value = dbNameArg.value;
  if (value.type !== "keyValue") {
    return "";
  }

  return unquotePrismaString(valueToPrisma(value.value));
}

function blockAttributeFields(attribute: BlockAttribute) {
  const [fieldsArg] = attribute.args ?? [];
  const value = fieldsArg?.value;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "array"
  ) {
    return [];
  }

  return (value.args ?? [])
    .map((field) => (typeof field === "string" ? field.trim() : ""))
    .filter(Boolean);
}

function blockAttributeExtraArgs(attribute: BlockAttribute) {
  return (attribute.args ?? []).slice(1).flatMap((argument) => {
    const value = argument.value;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.type === "keyValue" &&
      (value.key === "map" || value.key === "name")
    ) {
      return [];
    }

    return [valueToPrisma(value)];
  });
}

async function readPrismaSchemaContent(projectName: string, version: string) {
  return readFile(getSchemaFilePath(projectName, version), "utf8");
}

function fieldTypeName(field: Field) {
  return typeof field.fieldType === "string" ? field.fieldType : field.fieldType.name;
}

function relationAttributeName(field: Field) {
  const relationAttribute = findAttribute(field, "relation");
  if (!relationAttribute) return "";

  // Positional string form: @relation("name")
  const positional = relationAttribute.args?.find((argument) => {
    const value = argument.value;
    return (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value.type !== "keyValue"
    );
  });
  if (positional) return unquotePrismaString(valueToPrisma(positional.value));

  // Named keyword form: @relation(name: "name", ...)
  return relationAttributeStringArg(field, "name");
}

function relationAttributeArrayArg(field: Field, key: string) {
  const relationAttribute = findAttribute(field, "relation");
  const argument = relationAttribute?.args?.find((item) => {
    const value = item.value;

    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.type === "keyValue" &&
      value.key === key
    );
  });
  const value = argument?.value;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "keyValue" ||
    typeof value.value !== "object" ||
    Array.isArray(value.value) ||
    !value.value ||
    value.value.type !== "array"
  ) {
    return [];
  }

  return (value.value.args ?? [])
    .map((item) => unquotePrismaString(valueToPrisma(item)))
    .filter(Boolean);
}

function relationAttributeStringArg(field: Field, key: string) {
  const relationAttribute = findAttribute(field, "relation");
  const argument = relationAttribute?.args?.find((item) => {
    const value = item.value;

    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.type === "keyValue" &&
      value.key === key
    );
  });
  const value = argument?.value;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "keyValue"
  ) {
    return "";
  }

  return unquotePrismaString(valueToPrisma(value.value));
}

function fieldFromPrismaAst(field: Field): CanonicalField {
  const rawType = typeof field.fieldType === "string" ? field.fieldType : field.fieldType.name;
  const native = getNativeAttribute(field);
  const logicalType = prismaToLogicalTypes[rawType] ?? rawType;
  const constraints: CanonicalConstraint[] = [];

  if (findAttribute(field, "id")) {
    constraints.push({ type: "PK" });
  }

  if (findAttribute(field, "updatedAt")) {
    constraints.push({ type: "UPDATED_AT" });
  }

  if (native) {
    constraints.push({ type: "NATIVE", ...native });
  } else if (isTimestampField(field)) {
    constraints.push({ type: "NATIVE", name: "Timestamptz", args: ["6"] });
  }

  const key = randomUUID();
  return {
    key,
    fieldId: key,
    name: field.name,
    type: logicalType,
    nullable: Boolean(field.optional),
    default: getDefaultValue(field),
    comment: field.comment?.replace(/^\/\/\s?/, "") ?? "",
    constraints,
    array: Boolean(field.array),
    relation: findAttribute(field, "relation")
      ? {
          name: relationAttributeName(field),
          fields: relationAttributeArrayArg(field, "fields"),
          references: relationAttributeArrayArg(field, "references"),
          onDelete: relationAttributeStringArg(field, "onDelete"),
          onUpdate: relationAttributeStringArg(field, "onUpdate"),
        }
      : undefined,
  };
}

function fieldRestrictionFromPrismaAst(field: Field): CanonicalRestriction | null {
  const uniqueAttribute = findAttribute(field, "unique");

  if (!uniqueAttribute) {
    return null;
  }

  return {
    key: randomUUID(),
    type: "UNIQUE",
    fields: [field.name],
    dbName: attributeDbName(uniqueAttribute),
  };
}

function restrictionFromPrismaAst(
  attribute: BlockAttribute,
): CanonicalRestriction | null {
  if (attribute.name !== "unique" && attribute.name !== "index") {
    return null;
  }

  const fields = blockAttributeFields(attribute);

  if (fields.length === 0) {
    return null;
  }

  return {
    key: randomUUID(),
    type: attribute.name === "unique" ? "UNIQUE" : "INDEX",
    fields,
    dbName: attributeDbName(attribute),
    extraArgs: blockAttributeExtraArgs(attribute),
  };
}

function storeFromPrisma(
  content: string,
  projectName: string,
  version: string,
): CanonicalModelStore {
  const schema = getSchema(content);
  const enums = schema.list
    .filter(isEnumBlock)
    .map((item: any) => ({
      name: item.name,
      values: (item.enumerators ?? item.properties ?? [])
        .map((value: any) => value.name)
        .filter(Boolean),
    }))
    .filter((item) => item.name && item.values.length > 0);
  const models = schema.list.filter(isModelBlock).map((model) => {
    const astFields = model.properties.filter(isFieldProperty);
    const canonicalFields = astFields.map(fieldFromPrismaAst);
    const fieldKeyByName = new Map(canonicalFields.map((f) => [f.name, f.key]));

    // Build restrictions using field keys (not names)
    const restrictions: CanonicalRestriction[] = [
      ...astFields
        .map((astField): CanonicalRestriction | null => {
          const uniqueAttribute = findAttribute(astField, "unique");
          if (!uniqueAttribute) return null;
          const fieldKey = fieldKeyByName.get(astField.name);
          if (!fieldKey) return null;
          return {
            key: randomUUID(),
            type: "UNIQUE",
            fields: [fieldKey],
            dbName: attributeDbName(uniqueAttribute),
          };
        })
        .filter((r): r is CanonicalRestriction => Boolean(r)),
      ...model.properties
        .filter(isBlockAttributeProperty)
        .map((attribute): CanonicalRestriction | null => {
          if (attribute.name !== "unique" && attribute.name !== "index") return null;
          const fieldNames = blockAttributeFields(attribute);
          if (fieldNames.length === 0) return null;
          // Convert field names to keys
          const fieldKeys = fieldNames.map((name) => fieldKeyByName.get(name) ?? name);
          return {
            key: randomUUID(),
            type: attribute.name === "unique" ? "UNIQUE" : "INDEX",
            fields: fieldKeys,
            dbName: attributeDbName(attribute),
            extraArgs: blockAttributeExtraArgs(attribute),
          };
        })
        .filter((r): r is CanonicalRestriction => Boolean(r)),
    ];

    return {
      key: randomUUID(),
      tableId: randomUUID(),
      name: model.name,
      fields: canonicalFields,
      restrictions,
    };
  });

  // Second pass: resolve relation.fields / relation.references from names to field keys.
  // The Prisma @relation attribute stores field names; we need to convert them to keys.
  const fieldKeyByModelAndName = new Map<string, Map<string, string>>();
  for (const model of models) {
    const byName = new Map(model.fields.filter((f) => !f.relation).map((f) => [f.name, f.key]));
    fieldKeyByModelAndName.set(model.name, byName);
    fieldKeyByModelAndName.set(model.key, byName);
  }

  const modelByName = new Map(models.map((m) => [m.name, m]));

  for (const model of models) {
    for (const field of model.fields) {
      if (!field.relation) continue;
      const relFields = field.relation.fields ?? [];
      const relRefs = field.relation.references ?? [];
      if (relFields.length === 0) continue;

      // Resolve local FK names to keys in this model
      const localByName = fieldKeyByModelAndName.get(model.name);
      if (localByName) {
        field.relation.fields = relFields.map((name) => localByName.get(name) ?? name);
      }

      // Resolve referenced field names to keys in the target model
      // In storeFromPrisma, field.type is still a Prisma scalar name at this point
      // (relation target is the raw type string, not a UUID key yet)
      const targetModel = modelByName.get(field.type);
      if (targetModel) {
        const targetByName = fieldKeyByModelAndName.get(targetModel.name);
        if (targetByName) {
          field.relation.references = relRefs.map((name) => targetByName.get(name) ?? name);
        }
        // Also update the field type to the model key
        field.type = targetModel.key;
      }
    }
  }

  return {
    schemaVersion,
    projectName,
    projectVersion: version,
    provider: getProviderFromPrisma(content),
    enums,
    models,
  };
}

function modelSyncResult(store: CanonicalModelStore): PrismaModelSyncResult {
  return {
    fieldCount: store.models.reduce(
      (count, model) => count + model.fields.length,
      0,
    ),
    provider: store.provider,
    relationCount: store.models.reduce(
      (count, model) =>
        count +
        model.fields.filter((field) => Boolean(field.relation)).length,
      0,
    ),
    tableCount: store.models.length,
  };
}

async function createEmptyStore(projectName: string, version: string, provider = "postgresql") {
  const store: CanonicalModelStore = {
    schemaVersion,
    projectName,
    projectVersion: version,
    provider: normalizeProvider(provider),
    enums: [],
    models: [],
  };
  writeModelStore(store);
  return store;
}

async function readModelStore(projectName: string, version: string) {
  const projectId = getProjectIdByName(projectName);
  if (projectId) {
    const row = db.prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?").get(projectId, version) as { content: string } | undefined;
    if (row) {
      return normalizeStore(JSON.parse(row.content), projectName, version);
    }
  }
  return createEmptyStore(projectName, version);
}

function findModel(
  store: CanonicalModelStore,
  identifier: { key?: string; name?: string },
) {
  const key = identifier.key?.trim();
  const name = identifier.name?.trim();

  return store.models.find(
    (model) => (key && model.key === key) || (name && model.name === name),
  );
}

function assertUniqueModelName(
  store: CanonicalModelStore,
  name: string,
  exceptKey = "",
) {
  if (store.models.some((model) => model.key !== exceptKey && model.name === name)) {
    throw new Error("A model with this name already exists.");
  }
}

function assertUniqueFieldName(
  model: CanonicalModel,
  name: string,
  exceptKey = "",
) {
  if (model.fields.some((field) => field.key !== exceptKey && field.name === name)) {
    throw new Error("A field with this name already exists.");
  }
}

function syncSingleFieldUniqueRestriction(
  model: CanonicalModel,
  fieldKey: string,
  unique: boolean,
) {
  const existingIndex = model.restrictions.findIndex(
    (restriction) =>
      restriction.type === "UNIQUE" &&
      restriction.fields.length === 1 &&
      restriction.fields[0] === fieldKey,
  );

  if (unique && existingIndex === -1) {
    model.restrictions.push({
      key: randomUUID(),
      type: "UNIQUE",
      fields: [fieldKey],
    });
  }

  if (!unique && existingIndex !== -1) {
    model.restrictions.splice(existingIndex, 1);
  }
}

function ensureUniqueRelationFields(model: CanonicalModel, fieldKeys: string[]) {
  if (fieldKeys.length === 0) {
    return;
  }

  const identity = restrictionIdentity({
    key: "",
    type: "UNIQUE",
    fields: fieldKeys,
  });
  const hasRestriction = model.restrictions.some(
    (restriction) => restrictionIdentity(restriction) === identity,
  );

  if (!hasRestriction) {
    model.restrictions.push({
      key: randomUUID(),
      type: "UNIQUE",
      fields: fieldKeys,
    });
  }
}

function removeFieldRestrictions(model: CanonicalModel, fieldKey: string) {
  model.restrictions = model.restrictions.filter(
    (restriction) => !restriction.fields.includes(fieldKey),
  );
}

function removeUnusedRelationScalarFields(
  model: CanonicalModel,
  relationField: CanonicalField,
  keepFieldKeys: string[] = [],
) {
  const relationScalarFieldKeys = relationField.relation?.fields ?? [];
  if (relationScalarFieldKeys.length === 0) {
    return;
  }

  const keysToKeep = new Set(keepFieldKeys);
  const relationFieldKeysInUse = new Set(
    model.fields.flatMap((field) =>
      field.key !== relationField.key ? field.relation?.fields ?? [] : [],
    ),
  );
  const keysToRemove = relationScalarFieldKeys.filter(
    (fieldKey) => !keysToKeep.has(fieldKey) && !relationFieldKeysInUse.has(fieldKey),
  );

  if (keysToRemove.length === 0) {
    return;
  }

  model.fields = model.fields.filter((field) => !keysToRemove.includes(field.key));
  keysToRemove.forEach((fieldKey) => removeFieldRestrictions(model, fieldKey));
}

function assertRestrictionFields(
  model: CanonicalModel,
  type: PrismaRestrictionType,
  fields: string[],
) {
  if (fields.length === 0) {
    throw new Error("Select at least one field for this restriction.");
  }

  const fieldNames = new Set(model.fields.map((field) => field.name));
  const duplicatedFields = new Set<string>();
  const seenFields = new Set<string>();

  for (const fieldName of fields) {
    if (!fieldNames.has(fieldName)) {
      throw new Error(`Field ${fieldName} was not found in the selected model.`);
    }

    if (seenFields.has(fieldName)) {
      duplicatedFields.add(fieldName);
    }

    seenFields.add(fieldName);
  }

  if (duplicatedFields.size > 0) {
    throw new Error("A restriction cannot contain the same field more than once.");
  }

  if (type === "UNIQUE") {
    const booleanField = model.fields.find(
      (field) =>
        fields.includes(field.name) &&
        field.type === "boolean",
    );

    if (booleanField) {
      throw new Error("Boolean fields cannot be marked unique.");
    }
  }
}

function assertUniqueRestriction(
  model: CanonicalModel,
  type: PrismaRestrictionType,
  fields: string[],
  exceptKey = "",
) {
  const identity = `${type}:${fields.join("\u0000")}`;

  if (
    model.restrictions.some(
      (restriction) =>
        restriction.key !== exceptKey && restrictionIdentity(restriction) === identity,
    )
  ) {
    throw new Error("A restriction with these fields already exists.");
  }
}

// Resolve field keys stored in a restriction to display names for the UI.
function resolveRestrictionFieldNames(restriction: CanonicalRestriction, model: CanonicalModel): string[] {
  return restriction.fields.map(
    (keyOrName) => model.fields.find((f) => f.key === keyOrName)?.name ?? keyOrName,
  );
}

function restrictionPreview(restriction: CanonicalRestriction, model: CanonicalModel) {
  const fieldNames = resolveRestrictionFieldNames(restriction, model);
  if (restriction.type === "UNIQUE" && fieldNames.length === 1) {
    return `${fieldNames[0]} @unique`;
  }

  return renderBlockRestriction(restriction, model).trim();
}

function canonicalRestrictionToUiRestriction(
  restriction: CanonicalRestriction,
  model: CanonicalModel,
): PrismaRestriction {
  const fieldNames = resolveRestrictionFieldNames(restriction, model);
  return {
    key: restriction.key,
    type: restriction.type,
    fields: fieldNames,
    dbName: restriction.dbName ?? "",
    source:
      restriction.type === "UNIQUE" && restriction.fields.length === 1
        ? "field"
        : "model",
    preview: restrictionPreview(restriction, model),
  };
}

function modelFieldsToUiFields(
  store: CanonicalModelStore,
  model: CanonicalModel,
) {
  const modelNames = store.models.map((item) => item.name);
  const enumTypes = store.enums?.map((item) => item.name) ?? [];
  const modelKeyToName = new Map(store.models.map((m) => [m.key, m.name]));

  return model.fields.map((field) =>
    canonicalFieldToUiField(field, modelNames, enumTypes, model.restrictions, modelKeyToName),
  );
}

export async function initializeModelSchema(
  projectName: string,
  version: string,
  provider: string,
) {
  await createEmptyStore(projectName, version, provider);
}

export async function writeModelStoreFromPrismaContent(
  projectName: string,
  version: string,
  content: string,
): Promise<PrismaModelSyncResult> {
  const store = storeFromPrisma(content, projectName, version);
  await writeModelStore(store);
  return modelSyncResult(store);
}

export async function syncModelStoreFromPrismaSchema(
  projectName: string,
  version: string,
): Promise<PrismaModelSyncResult> {
  const content = await readPrismaSchemaContent(projectName, version);
  return writeModelStoreFromPrismaContent(projectName, version, content);
}

export async function getSchemaStore(projectName: string, version: string) {
  return readModelStore(projectName, version);
}

export async function readSchema(projectName: string, version: string) {
  const store = await readModelStore(projectName, version);

  return store.models.map((model) => {
    const pk = getPrimaryKey(model);

    return {
      key: model.key,
      name: model.name,
      pkName: pk?.name ?? "",
      pkType: getPkType(pk),
    };
  });
}

export async function readModelFields(
  projectName: string,
  version: string,
  modelName: string,
  modelKey = "",
): Promise<PrismaModelFields> {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const enumTypes = store.enums?.map((item) => item.name) ?? [];

  return {
    modelKey: model.key,
    modelName: model.name,
    fields: modelFieldsToUiFields(store, model),
    enumTypes,
    scalarTypes,
  };
}

export async function readModelRelations(
  projectName: string,
  version: string,
  modelName: string,
  modelKey = "",
): Promise<PrismaModelRelations> {
  // Resolve project + version IDs from SQLite
  const projectRow = db
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  if (!projectRow) throw new Error("Project not found.");

  const versionRow = db
    .prepare("SELECT id FROM project_versions WHERE project_id = ? AND name = ?")
    .get(projectRow.id, version) as { id: number } | undefined;
  if (!versionRow) throw new Error("Version not found.");

  type TableRow = { id: string; model_key: string; name: string };
  type FieldRow = { id: string; field_key: string; table_id: string; name: string };
  type RelationRow = { id: string; name: string; source_table_id: string; target_table_id: string; cardinality: string; on_delete: string; on_update: string };
  type SideRow = { id: string; relation_id: string; table_id: string; field_name: string; is_owner: number; is_list: number; nullable: number };
  type PairRow = { relation_id: string; source_field_id: string; target_field_id: string; sort_order: number };

  // Find this model's table row (prefer key lookup)
  let tableRow: TableRow | undefined;
  if (modelKey) {
    tableRow = db
      .prepare("SELECT id, model_key, name FROM schema_tables WHERE version_id = ? AND model_key = ?")
      .get(versionRow.id, modelKey) as TableRow | undefined;
  }
  if (!tableRow) {
    tableRow = db
      .prepare("SELECT id, model_key, name FROM schema_tables WHERE version_id = ? AND name = ?")
      .get(versionRow.id, modelName) as TableRow | undefined;
  }
  if (!tableRow) throw new Error("Model was not found in the selected schema.");

  // All tables in this version (for resolving target model names + keys)
  const allTables = db
    .prepare("SELECT id, model_key, name FROM schema_tables WHERE version_id = ?")
    .all(versionRow.id) as TableRow[];
  const tableById = new Map(allTables.map((t) => [t.id, t]));

  // All scalar fields in this version (for FK field name resolution)
  const allTableIds = allTables.map((t) => t.id);
  const allFields = allTableIds.length
    ? (db
        .prepare(`SELECT id, field_key, table_id, name FROM schema_fields WHERE table_id IN (${allTableIds.map(() => "?").join(",")})`)
        .all(...allTableIds) as FieldRow[])
    : [];
  const fieldById = new Map(allFields.map((f) => [f.id, f]));

  // All relations in this version
  const relationRows = db
    .prepare("SELECT * FROM schema_relations WHERE version_id = ?")
    .all(versionRow.id) as RelationRow[];
  const relationIds = relationRows.map((r) => r.id);

  // All sides + field pairs for those relations
  const sideRows = relationIds.length
    ? (db
        .prepare(`SELECT * FROM schema_relation_sides WHERE relation_id IN (${relationIds.map(() => "?").join(",")})`)
        .all(...relationIds) as SideRow[])
    : [];
  const pairRows = relationIds.length
    ? (db
        .prepare(`SELECT * FROM schema_relation_fields WHERE relation_id IN (${relationIds.map(() => "?").join(",")}) ORDER BY sort_order`)
        .all(...relationIds) as PairRow[])
    : [];

  const sidesByRelation = new Map<string, SideRow[]>();
  for (const side of sideRows) {
    const list = sidesByRelation.get(side.relation_id) ?? [];
    list.push(side);
    sidesByRelation.set(side.relation_id, list);
  }
  const pairsByRelation = new Map<string, PairRow[]>();
  for (const pair of pairRows) {
    const list = pairsByRelation.get(pair.relation_id) ?? [];
    list.push(pair);
    pairsByRelation.set(pair.relation_id, list);
  }

  function deriveKind(
    thisIsList: boolean,
    otherIsList: boolean,
  ): PrismaRelation["kind"] {
    if (thisIsList && otherIsList) return "many-to-many";
    if (thisIsList) return "one-to-many";
    if (otherIsList) return "many-to-one";
    return "one-to-one";
  }

  function buildPreview(fieldName: string, targetName: string, isList: boolean, isNullable: boolean, relName: string): string {
    const suffix = isList ? "[]" : isNullable ? "?" : "";
    const relPart = relName ? ` @relation("${relName}")` : " @relation";
    return `${fieldName} ${targetName}${suffix}${relPart}`;
  }

  // Build PrismaRelation for each side belonging to this table
  const relations: PrismaRelation[] = [];

  for (const rel of relationRows) {
    const relSides = sidesByRelation.get(rel.id) ?? [];
    const thisSide = relSides.find((s) => s.table_id === tableRow!.id);
    if (!thisSide) continue;

    const otherSide = relSides.find((s) => s.id !== thisSide.id);
    const otherTable = tableById.get(otherSide?.table_id ?? "");
    const pairs = pairsByRelation.get(rel.id) ?? [];

    // FK fields and references — only the owner side carries these
    const fields: string[] = [];
    const references: string[] = [];
    if (thisSide.is_owner) {
      for (const pair of pairs) {
        const src = fieldById.get(pair.source_field_id);
        const tgt = fieldById.get(pair.target_field_id);
        if (src) fields.push(src.name);
        if (tgt) references.push(tgt.name);
      }
    }

    const isBackReference = thisSide.is_owner === 0;
    const kind = deriveKind(thisSide.is_list === 1, otherSide ? otherSide.is_list === 1 : false);

    relations.push({
      key: thisSide.id,
      name: thisSide.field_name,
      targetModel: otherTable?.name ?? "",
      targetModelKey: otherTable?.model_key ?? "",
      backReferenceKey: otherSide?.id,
      backReferenceName: otherSide?.field_name,
      fields,
      references,
      onDelete: rel.on_delete,
      onUpdate: rel.on_update,
      isArray: thisSide.is_list === 1,
      nullable: thisSide.nullable === 1,
      isBackReference,
      kind,
      preview: buildPreview(
        thisSide.field_name,
        otherTable?.name ?? "",
        thisSide.is_list === 1,
        thisSide.nullable === 1,
        rel.name,
      ),
    });
  }

  // Scalar fields still read from model_stores (same SQLite DB)
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: tableRow.model_key, name: tableRow.name });
  const uiFields = model ? modelFieldsToUiFields(store, model) : [];

  return {
    modelKey: tableRow.model_key,
    modelName: tableRow.name,
    fields: uiFields,
    relations,
  };
}

export async function createModelRelation(
  projectName: string,
  version: string,
  modelName: string,
  input: PrismaRelationInput,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const nextField = relationInputToCanonicalField(input, store, model);
  const targetModel = findModelByRelationType(nextField.type, store);

  if (!targetModel) {
    throw new Error("Target table was not found in the selected schema.");
  }

  const backReferenceField = relationInputToBackReferenceField(input, model, nextField.relation?.name ?? "");
  assertUniqueFieldName(model, nextField.name);
  assertUniqueFieldName(targetModel, backReferenceField.name);
  if (targetModel.key === model.key && nextField.name === backReferenceField.name) {
    throw new Error("Relation field and back reference field must have different names.");
  }
  model.fields.push(nextField);
  if (!input.backReferenceIsArray) {
    ensureUniqueRelationFields(model, nextField.relation?.fields ?? []);
  }
  targetModel.fields.push(backReferenceField);

  writeModelStore(store);
  return readModelRelations(projectName, version, model.name, model.key);
}

export async function updateModelRelation(
  projectName: string,
  version: string,
  modelName: string,
  relationKey: string,
  input: PrismaRelationInput,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const fieldIndex = model.fields.findIndex((field) => field.key === relationKey);

  if (fieldIndex === -1) {
    throw new Error("Relation was not found in the selected model.");
  }

  const currentField = model.fields[fieldIndex];
  const currentBackReference = findBackReferenceField(store, model, currentField);
  const nextField = relationInputToCanonicalField(
    input,
    store,
    model,
    relationKey,
  );
  const targetModel = findModelByRelationType(nextField.type, store);

  if (!targetModel) {
    throw new Error("Target table was not found in the selected schema.");
  }

  const nextBackReference = relationInputToBackReferenceField(
    input,
    model,
    nextField.relation?.name ?? "",
    currentBackReference?.model.key === targetModel.key
      ? currentBackReference.field.key
      : randomUUID(),
  );
  assertUniqueFieldName(model, nextField.name, relationKey);
  assertUniqueFieldName(
    targetModel,
    nextBackReference.name,
    currentBackReference?.model.key === targetModel.key
      ? currentBackReference.field.key
      : "",
  );
  if (targetModel.key === model.key && nextField.name === nextBackReference.name) {
    throw new Error("Relation field and back reference field must have different names.");
  }
  model.fields[fieldIndex] = nextField;
  removeUnusedRelationScalarFields(
    model,
    currentField,
    nextField.relation?.fields ?? [],
  );
  if (!input.backReferenceIsArray) {
    ensureUniqueRelationFields(model, nextField.relation?.fields ?? []);
  }

  if (currentBackReference?.model.key === targetModel.key) {
    targetModel.fields[currentBackReference.fieldIndex] = nextBackReference;
  } else {
    if (currentBackReference) {
      currentBackReference.model.fields = currentBackReference.model.fields.filter(
        (field) => field.key !== currentBackReference.field.key,
      );
      removeFieldRestrictions(
        currentBackReference.model,
        currentBackReference.field.key,
      );
    }

    targetModel.fields.push(nextBackReference);
  }

  writeModelStore(store);
  return readModelRelations(projectName, version, model.name, model.key);
}

export async function deleteModelRelation(
  projectName: string,
  version: string,
  modelName: string,
  relationKey: string,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const fieldIndex = model.fields.findIndex((field) => field.key === relationKey);

  if (fieldIndex === -1) {
    throw new Error("Relation was not found in the selected model.");
  }

  const [deletedField] = model.fields.splice(fieldIndex, 1);
  if (deletedField) {
    const backReference = findBackReferenceField(store, model, deletedField);
    removeUnusedRelationScalarFields(model, deletedField);

    if (backReference) {
      backReference.model.fields = backReference.model.fields.filter(
        (field) => field.key !== backReference.field.key,
      );
      removeFieldRestrictions(backReference.model, backReference.field.key);
    }

    removeFieldRestrictions(model, deletedField.key);
  }

  writeModelStore(store);
  return readModelRelations(projectName, version, model.name, model.key);
}

export async function createModelField(
  projectName: string,
  version: string,
  modelName: string,
  input: PrismaFieldInput,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const nextField = fieldInputToCanonical(input, store);
  assertUniqueFieldName(model, nextField.name);
  model.fields.push(nextField);
  syncSingleFieldUniqueRestriction(
    model,
    nextField.key,
    input.unique && input.type !== "Boolean",
  );

  await writeModelStore(store);
  return readModelFields(projectName, version, model.name, model.key);
}

export async function updateModelField(
  projectName: string,
  version: string,
  modelName: string,
  oldFieldName: string,
  input: PrismaFieldInput,
  modelKey = "",
  fieldKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const fieldIndex = model.fields.findIndex(
    (field) =>
      (fieldKey && field.key === fieldKey) ||
      (!fieldKey && oldFieldName && field.name === oldFieldName),
  );

  if (fieldIndex === -1) {
    throw new Error("Field was not found in the selected model.");
  }

  const currentField = model.fields[fieldIndex];
  const nextField = fieldInputToCanonical(input, store, currentField.key, currentField.fieldId ?? currentField.key);
  assertUniqueFieldName(model, nextField.name, currentField.key);
  model.fields[fieldIndex] = {
    ...nextField,
    array: currentField.array,
  };
  syncSingleFieldUniqueRestriction(
    model,
    nextField.key,
    input.unique && input.type !== "Boolean",
  );

  await writeModelStore(store);
  return readModelFields(projectName, version, model.name, model.key);
}

export async function batchUpdateFieldComments(
  projectName: string,
  version: string,
  modelName: string,
  updates: { fieldKey: string; comment: string }[],
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  for (const { fieldKey, comment } of updates) {
    const field = model.fields.find((f) => f.key === fieldKey);
    if (field) {
      field.comment = comment.trim();
    }
  }

  await writeModelStore(store);
  return readModelFields(projectName, version, model.name, model.key);
}

export async function deleteModelField(
  projectName: string,
  version: string,
  modelName: string,
  fieldName: string,
  modelKey = "",
  fieldKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const fieldIndex = model.fields.findIndex(
    (field) =>
      (fieldKey && field.key === fieldKey) ||
      (!fieldKey && fieldName && field.name === fieldName),
  );

  if (fieldIndex === -1) {
    throw new Error("Field was not found in the selected model.");
  }

  const [deletedField] = model.fields.splice(fieldIndex, 1);
  if (deletedField) {
    removeFieldRestrictions(model, deletedField.key);
  }

  await writeModelStore(store);
  return readModelFields(projectName, version, model.name, model.key);
}

export async function readModelRestrictions(
  projectName: string,
  version: string,
  modelName: string,
  modelKey = "",
): Promise<PrismaModelRestrictions> {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  return {
    modelKey: model.key,
    modelName: model.name,
    fields: modelFieldsToUiFields(store, model).filter(
      (field) => field.isEditable && !field.isId,
    ),
    restrictions: model.restrictions.map((r) => canonicalRestrictionToUiRestriction(r, model)),
  };
}

export async function createModelRestriction(
  projectName: string,
  version: string,
  modelName: string,
  input: { type: string; fields: string[]; dbName?: string },
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const type = input.type === "INDEX" ? "INDEX" : "UNIQUE";
  const fieldNames = getUniqueStringArray(input.fields);
  const dbName = getString(input.dbName);

  // Validate field names (UI sends names)
  assertRestrictionFields(model, type, fieldNames);

  // Convert field names to keys for storage
  const fieldKeys = fieldNames.map(
    (name) => model.fields.find((f) => !f.relation && f.name === name)?.key ?? name,
  );

  assertUniqueRestriction(model, type, fieldKeys);
  model.restrictions.push({
    key: randomUUID(),
    type,
    fields: fieldKeys,
    dbName,
    extraArgs: [],
  });

  await writeModelStore(store);
  return readModelRestrictions(projectName, version, model.name, model.key);
}

export async function updateModelRestriction(
  projectName: string,
  version: string,
  modelName: string,
  restrictionKey: string,
  input: { type: string; fields: string[]; dbName?: string },
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const restrictionIndex = model.restrictions.findIndex(
    (restriction) => restriction.key === restrictionKey,
  );

  if (restrictionIndex === -1) {
    throw new Error("Restriction was not found in the selected model.");
  }

  const type = input.type === "INDEX" ? "INDEX" : "UNIQUE";
  const fieldNames = getUniqueStringArray(input.fields);
  const dbName = getString(input.dbName);

  // Validate field names (UI sends names)
  assertRestrictionFields(model, type, fieldNames);

  // Convert field names to keys for storage
  const fieldKeys = fieldNames.map(
    (name) => model.fields.find((f) => !f.relation && f.name === name)?.key ?? name,
  );

  assertUniqueRestriction(model, type, fieldKeys, restrictionKey);
  model.restrictions[restrictionIndex] = {
    key: restrictionKey,
    type,
    fields: fieldKeys,
    dbName,
    extraArgs: [],
  };

  await writeModelStore(store);
  return readModelRestrictions(projectName, version, model.name, model.key);
}

export async function deleteModelRestriction(
  projectName: string,
  version: string,
  modelName: string,
  restrictionKey: string,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: modelName });

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const restrictionIndex = model.restrictions.findIndex(
    (restriction) => restriction.key === restrictionKey,
  );

  if (restrictionIndex === -1) {
    throw new Error("Restriction was not found in the selected model.");
  }

  model.restrictions.splice(restrictionIndex, 1);

  await writeModelStore(store);
  return readModelRestrictions(projectName, version, model.name, model.key);
}

async function runPrismaSchemaTestStep(
  name: PrismaSchemaTestStep["name"],
  schemaFile: string,
): Promise<PrismaSchemaTestStep> {
  const args = ["prisma", name, "--schema", schemaFile];
  const command = `pnpm ${args.join(" ")}`;

  try {
    const { stdout, stderr } = await execFileAsync("pnpm", args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });

    return {
      command,
      name,
      output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      success: true,
    };
  } catch (error) {
    const processError = error as {
      stderr?: string;
      stdout?: string;
    };

    return {
      command,
      name,
      output: [processError.stdout, processError.stderr]
        .filter(Boolean)
        .join("\n")
        .trim(),
      success: false,
    };
  }
}

export async function testPrismaSchema(
  projectName: string,
  version: string,
): Promise<PrismaSchemaTestResult> {
  const graph = readProjectVersionGraph(projectName, version);
  const schemaContent = renderPrismaSchemaFromGraph(graph);
  await mkdir(schemaScratchDirectory, { recursive: true });
  const tempDirectory = await mkdtemp(path.join(schemaScratchDirectory, "schema-test-"));
  const tempSchemaFile = path.join(tempDirectory, `${toSchemaFilePart(version)}.prisma`);
  const steps: PrismaSchemaTestStep[] = [];

  try {
    await writeFile(tempSchemaFile, schemaContent, "utf8");

    const formatStep = await runPrismaSchemaTestStep("format", tempSchemaFile);
    steps.push(formatStep);

    if (!formatStep.success) {
      return { schemaFile: `(in-memory ${version})`, steps, success: false };
    }

    const validateStep = await runPrismaSchemaTestStep("validate", tempSchemaFile);
    steps.push(validateStep);

    return {
      schemaFile: `(in-memory ${version})`,
      steps,
      success: steps.every((step) => step.success),
    };
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

export async function addModel(
  projectName: string,
  version: string,
  modelName: string,
  pkName: string,
  pkType: string,
) {
  const store = await readModelStore(projectName, version);
  const name = modelName.trim();
  assertValidIdentifier(name, "Model name");
  assertUniqueModelName(store, name);

  const pkField = fieldInputToCanonical(pkFieldInput(pkName, pkType, store.provider), store);
  const model: CanonicalModel = {
    key: randomUUID(),
    tableId: randomUUID(),
    name,
    fields: [pkField],
    restrictions: [],
  };

  store.models.push(model);
  await writeModelStore(store);
}

export async function updateModel(
  projectName: string,
  version: string,
  oldModelName: string,
  newModelName: string,
  pkName: string,
  pkType: string,
  modelKey = "",
) {
  const store = await readModelStore(projectName, version);
  const model = findModel(store, { key: modelKey, name: oldModelName });

  if (!model) {
    throw new Error(`Could not update model ${oldModelName}`);
  }

  const name = newModelName.trim();
  assertValidIdentifier(name, "Model name");
  assertUniqueModelName(store, name, model.key);

  model.name = name;

  const currentPkIndex = model.fields.findIndex((field) =>
    field.constraints.some((constraint) => constraint.type === "PK"),
  );
  const currentPk = currentPkIndex >= 0 ? model.fields[currentPkIndex] : null;
  const nextPk = fieldInputToCanonical(
    pkFieldInput(pkName, pkType, store.provider),
    store,
    currentPk?.key ?? randomUUID(),
    currentPk?.fieldId ?? currentPk?.key ?? randomUUID(),
  );
  assertUniqueFieldName(model, nextPk.name, currentPk?.key ?? "");

  if (currentPkIndex >= 0) {
    model.fields[currentPkIndex] = nextPk;
  } else {
    model.fields.unshift(nextPk);
  }

  await writeModelStore(store);
}

export async function modelExistsInSchema(
  projectName: string,
  version: string,
  modelName: string,
): Promise<boolean> {
  const store = await readModelStore(projectName, version);
  return store.models.some((model) => model.name === modelName.trim());
}

export type SchemaStats = {
  fieldCount: number;
  relationCount: number;
  restrictionCount: number;
  tableCount: number;
};

export async function getSchemaStats(
  projectName: string,
  version: string,
): Promise<SchemaStats> {
  const store = await readModelStore(projectName, version);

  return {
    fieldCount: store.models.reduce(
      (count, model) => count + model.fields.length,
      0,
    ),
    relationCount: store.models.reduce(
      (count, model) =>
        count +
        model.fields.filter((field) => {
          const fields = field.relation?.fields ?? [];
          const references = field.relation?.references ?? [];
          return fields.length > 0 || references.length > 0;
        }).length,
      0,
    ),
    restrictionCount: store.models.reduce(
      (count, model) => count + model.restrictions.length,
      0,
    ),
    tableCount: store.models.length,
  };
}

const SQLITE_SCALAR_TYPES = new Set([
  "string", "integer", "bigint", "float", "decimal",
  "boolean", "timestamp", "json", "bytes",
]);

function prepareSQLiteStore(store: CanonicalModelStore): CanonicalModelStore {
  const s: CanonicalModelStore = JSON.parse(JSON.stringify(store));
  const enumNames = new Set((s.enums ?? []).map((e) => e.name));

  for (const model of s.models) {
    // ── Fix 1: primitive arrays ──────────────────────────────────────────────
    // SQLite does not support lists of primitive types.
    // Convert scalar array fields to nullable scalars and strip defaults.
    for (const field of model.fields) {
      if (
        field.array &&
        SQLITE_SCALAR_TYPES.has(field.type) &&
        !enumNames.has(field.type)
      ) {
        field.array = false;
        field.nullable = true;
        field.default = "";
      }
    }

    // ── Fix 2: ambiguous multi-FK relations ──────────────────────────────────
    // Multiple FK fields from the same model pointing to the same target without
    // distinct relation names → propagate names from named back-references.
    const fkByTarget = new Map<string, CanonicalField[]>();
    for (const field of model.fields) {
      if (field.relation && field.relation.fields.length > 0) {
        const bucket = fkByTarget.get(field.type) ?? [];
        bucket.push(field);
        fkByTarget.set(field.type, bucket);
      }
    }

    for (const [targetName, fkFields] of fkByTarget) {
      if (fkFields.length < 2) continue;

      const names = fkFields.map((f) => f.relation?.name ?? "").filter(Boolean);
      if (new Set(names).size === fkFields.length) continue;

      const targetModel = findModelByRelationType(targetName, s);
      if (!targetModel) continue;

      const namedBackRefs = targetModel.fields.filter(
        (f) =>
          findModelByRelationType(f.type, s)?.key === model.key &&
          f.relation !== undefined &&
          f.relation.fields.length === 0 &&
          f.relation.name,
      );

      for (const fkField of fkFields) {
        if (fkField.relation?.name) continue;
        const lower = fkField.name.toLowerCase();
        const matched = namedBackRefs.find((br) =>
          br.relation!.name!.toLowerCase().includes(lower),
        );
        fkField.relation!.name = matched
          ? matched.relation!.name!
          : `${model.name}_${fkField.name}`;
      }
    }

    // ── Fix 3: single FK with mismatched name ────────────────────────────────
    // One FK field has no name but its back-reference does → copy the name.
    for (const field of model.fields) {
      if (!field.relation || field.relation.fields.length === 0 || field.relation.name) {
        continue;
      }

      const targetName = field.type;
      // Count how many FK fields from this model point to the target
      const fkCountToTarget = model.fields.filter(
        (f) => f.relation && f.relation.fields.length > 0 && f.type === targetName,
      ).length;
      if (fkCountToTarget > 1) continue; // handled by Fix 2

      const targetModel = findModelByRelationType(targetName, s);
      if (!targetModel) continue;

      const backRefsToSource = targetModel.fields.filter(
        (f) =>
          findModelByRelationType(f.type, s)?.key === model.key &&
          f.relation !== undefined &&
          f.relation.fields.length === 0,
      );
      if (backRefsToSource.length === 1 && backRefsToSource[0].relation?.name) {
        field.relation.name = backRefsToSource[0].relation.name;
      }
    }
  }

  return s;
}

function renderFieldSQLite(field: CanonicalField, model: CanonicalModel, store: CanonicalModelStore): string {
  const prismaType = field.relation
    ? resolveRelationTypeName(field.type, store)
    : logicalTypeToPrismaType(field.type);
  const typeSuffix = field.array ? "[]" : field.nullable ? "?" : "";
  const uniqueRestriction = model.restrictions.find(
    (r) => r.type === "UNIQUE" && r.fields.length === 1 && r.fields[0] === field.key,
  );
  const attributes: string[] = [];

  if (field.constraints.some((c) => c.type === "PK")) attributes.push("@id");

  const uniqueAttr = renderFieldUniqueAttribute(uniqueRestriction);
  if (uniqueAttr) attributes.push(uniqueAttr);

  if (field.default && !field.default.startsWith("dbgenerated(")) {
    attributes.push(`@default(${field.default})`);
  }

  if (field.constraints.some((c) => c.type === "UPDATED_AT")) attributes.push("@updatedAt");

  // Skip @db.* native attributes — not valid for SQLite provider

  if (field.relation) {
    const targetModel = field.relation.fields.length > 0
      ? findModelByRelationType(field.type, store)
      : undefined;
    const relAttr = renderRelationAttribute(field.relation, model, targetModel);
    if (relAttr) attributes.push(relAttr);
  }

  const comment = field.comment ? ` // ${field.comment}` : "";
  return `  ${field.name} ${prismaType}${typeSuffix}${attributes.length ? ` ${attributes.join(" ")}` : ""}${comment}`;
}

export async function generateSQLiteSchema(
  projectName: string,
  version: string,
): Promise<string> {
  const store = prepareSQLiteStore(await readModelStore(projectName, version));

  const prelude = `datasource db {
  provider = "sqlite"
}

generator client {
  provider = "prisma-client-js"
}`;

  const chunks: string[] = [prelude];

  for (const item of store.enums ?? []) {
    chunks.push(`enum ${item.name} {\n${item.values.map((v) => `  ${v}`).join("\n")}\n}`);
  }

  for (const model of store.models) {
    const fieldLines = model.fields.map((field) => renderFieldSQLite(field, model, store));
    const restrictionLines = model.restrictions.map((r) => renderBlockRestriction(r, model)).filter(Boolean);
    chunks.push(
      `model ${model.name} {\n${[...fieldLines, ...restrictionLines].join("\n")}\n}`,
    );
  }

  return `${chunks.filter(Boolean).join("\n\n")}\n`;
}
