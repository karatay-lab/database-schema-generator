import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSchemaStore } from "@/lib/schema-store";
import { registerFsPath } from "@/lib/db/fs-paths";
import { upsertZodSchema } from "@/lib/db/zod-schemas";
import { db } from "@/lib/db/client";

const databaseDirectory = path.join(process.cwd(), "src/database");
const zodDirectory = path.join(databaseDirectory, "zod");

export type ZodGeneratorInput = {
  projectName: string;
  version: string;
  modelName: string;
  modelKey: string;
  selectedFieldKeys: string[];
};

export type ZodGeneratorOutput = {
  code: string;
  filePath: string;
  schemaCount: number;
  enumCount: number;
  warnings: string[];
};

function toSchemaFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getZodFilePath(projectName: string, version: string, tableName: string) {
  return path.join(
    zodDirectory,
    toSchemaFilePart(projectName),
    toSchemaFilePart(version),
    `${toSchemaFilePart(tableName)}.ts`,
  );
}

function logicalToZodType(
  logicalType: string,
  isUuid: boolean,
  isTimestamp: boolean,
): string {
  if (isUuid) {
    return "z.uuidv4()";
  }
  if (isTimestamp) {
    return "z.date()";
  }
  switch (logicalType) {
    case "string":
      return "z.string()";
    case "integer":
      return "z.number().int()";
    case "bigint":
      return "z.bigint()";
    case "float":
    case "decimal":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "timestamp":
      return "z.date()";
    case "json":
      return "z.unknown()";
    case "bytes":
      return "z.instanceof(Uint8Array)";
    default:
      return "z.unknown()";
  }
}

function isScalarType(type: string) {
  return [
    "string",
    "integer",
    "bigint",
    "float",
    "decimal",
    "boolean",
    "timestamp",
    "json",
    "bytes",
  ].includes(type);
}

type GeneratedSchemaEntry = {
  name: string;
  code: string;
  isEnum: boolean;
};

function pascalCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export async function generateZodSchema(
  input: ZodGeneratorInput,
): Promise<ZodGeneratorOutput> {
  const store = await getSchemaStore(input.projectName, input.version);
  const model = store.models.find(
    (m) =>
      (input.modelKey && m.key === input.modelKey) ||
      m.name === input.modelName,
  );

  if (!model) {
    throw new Error("Model was not found in the selected schema.");
  }

  const enumTypes = store.enums?.map((e) => e.name) ?? [];
  // Owning-side relation: has relation.fields (the FK lives here). Back-reference: relation.fields is empty.
  const selectedCanonicalFields = model.fields.filter(
    (f) =>
      input.selectedFieldKeys.includes(f.key) &&
      !(f.relation && f.relation.fields.length === 0),
  );

  const unknownTypes = selectedCanonicalFields.filter((f) => {
    if (f.relation) return false; // owning-side relation — handled below
    return !isScalarType(f.type) && !enumTypes.includes(f.type);
  });

  if (unknownTypes.length > 0) {
    throw new Error(
      `Unsupported field types: ${unknownTypes.map((f) => `${f.name} (${f.type})`).join(", ")}`,
    );
  }

  const allGeneratedSchemas = new Map<string, GeneratedSchemaEntry>();

  const schemaFieldCodes: string[] = [];

  for (const field of selectedCanonicalFields) {
    const isUuid =
      field.constraints.some(
        (c) => c.type === "NATIVE" && c.name === "Uuid",
      ) ||
      (field.type === "string" &&
        field.constraints.some(
          (c) => c.type === "NATIVE" && c.name === "Uuid",
        ));
    const isTimestamp = field.constraints.some(
      (c) => c.type === "NATIVE" && c.name === "Timestamptz",
    );

    const isEnumType = enumTypes.includes(field.type);
    const relatedModel = field.relation
      ? store.models.find((m) => m.name === field.type || m.key === field.type)
      : undefined;

    let baseCode: string;

    if (isEnumType) {
      const schemaName = pascalCase(field.type) + "Schema";
      if (!allGeneratedSchemas.has(schemaName)) {
        const enumDef = store.enums?.find((e) => e.name === field.type);
        if (enumDef) {
          allGeneratedSchemas.set(schemaName, {
            name: schemaName,
            code: `export const ${schemaName} = z.enum([${enumDef.values.map((v) => JSON.stringify(v)).join(", ")}])`,
            isEnum: true,
          });
        }
      }
      baseCode = schemaName;
    } else if (relatedModel) {
      const schemaName = pascalCase(relatedModel.name) + "Schema";
      if (!allGeneratedSchemas.has(schemaName)) {
        const subFields = relatedModel.fields.filter(
          (f) => !f.relation && (isScalarType(f.type) || enumTypes.includes(f.type)),
        );
        const subEntries = subFields.map((f) => {
          const subIsUuid =
            f.constraints.some((c) => c.type === "NATIVE" && c.name === "Uuid") ||
            (f.type === "string" && f.constraints.some((c) => c.type === "NATIVE" && c.name === "Uuid"));
          const subIsTimestamp = f.constraints.some((c) => c.type === "NATIVE" && c.name === "Timestamptz");
          const subCode = f.array
            ? `z.array(${logicalToZodType(f.type, subIsUuid, subIsTimestamp)})`
            : logicalToZodType(f.type, subIsUuid, subIsTimestamp);
          return `  ${f.name}: ${f.nullable ? `${subCode}.nullable()` : subCode}`;
        });
        allGeneratedSchemas.set(schemaName, {
          name: schemaName,
          code: `export const ${schemaName} = z.object({\n${subEntries.join(",\n")}\n})`,
          isEnum: false,
        });
      }
      baseCode = schemaName;
    } else {
      baseCode = logicalToZodType(field.type, isUuid, isTimestamp);
    }

    if (field.array) {
      baseCode = `z.array(${baseCode})`;
    }
    if (field.nullable) {
      baseCode = `${baseCode}.nullable()`;
    }

    schemaFieldCodes.push(`  ${field.name}: ${baseCode}`);
  }

  const primarySchemaName = pascalCase(model.name) + "Schema";
  const primaryInterfaceName = pascalCase(model.name);

  const lines: string[] = [
    "import { z } from \"zod\";",
    "",
  ];

  const enumEntries = Array.from(allGeneratedSchemas.values()).filter((e) => e.isEnum);
  const nestedEntries = Array.from(allGeneratedSchemas.values()).filter((e) => !e.isEnum);

  for (const entry of [...enumEntries, ...nestedEntries]) {
    lines.push(entry.code);
    lines.push("");
  }

  lines.push(`export const ${primarySchemaName} = z.object({`);
  lines.push(schemaFieldCodes.join(",\n"));
  lines.push("});");
  lines.push("");
  lines.push(`export type ${primaryInterfaceName} = z.infer<typeof ${primarySchemaName}>;`);

  const code = lines.join("\n");
  const filePath = getZodFilePath(
    input.projectName,
    input.version,
    model.name,
  );

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, code, "utf8");
  const pidRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(input.projectName) as { id: string } | undefined;
  if (pidRow) {
    registerFsPath({ projectId: pidRow.id, version: input.version, fileType: "zod_file", label: model.name, fsPath: filePath });
    upsertZodSchema({
      projectId: pidRow.id,
      version: input.version,
      modelName: model.name,
      fsPath: filePath,
      schemaCount: nestedEntries.length + 1,
      enumCount: enumEntries.length,
      fieldCount: selectedCanonicalFields.length,
      selectedFieldKeys: input.selectedFieldKeys,
    });
  }

  return {
    code,
    filePath: path.relative(process.cwd(), filePath),
    schemaCount: nestedEntries.length + 1,
    enumCount: enumEntries.length,
    warnings: [],
  };
}