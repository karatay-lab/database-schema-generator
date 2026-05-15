export function fieldTypeBadgeClass(type: string): string {
  if (type === "Int" || type === "integer" || type === "BigInt" || type === "bigint") return "bg-blue-50 text-blue-700";
  if (type === "String" || type === "string") return "bg-green-50 text-green-700";
  if (type === "DateTime" || type === "timestamp") return "bg-orange-50 text-orange-700";
  if (type === "Uuid") return "bg-purple-50 text-purple-700";
  if (type === "Float" || type === "float" || type === "Decimal" || type === "decimal") return "bg-cyan-50 text-cyan-700";
  if (type === "Boolean" || type === "boolean") return "bg-emerald-50 text-emerald-700";
  if (type === "Bytes" || type === "bytes") return "bg-amber-50 text-amber-700";
  if (type === "Json" || type === "json") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-600";
}
