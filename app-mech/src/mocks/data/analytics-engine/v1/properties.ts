// eventId + key must be unique per the @@unique constraint.
export const properties = [
  { id: "24000000-0000-0000-0000-000000000001", eventId: "23000000-0000-0000-0000-000000000001", key: "page_url", value: "https://app.analytics.io/dashboard", valueType: "string", createdAt: "2024-03-10T09:00:31.000Z" },
  { id: "24000000-0000-0000-0000-000000000002", eventId: "23000000-0000-0000-0000-000000000001", key: "page_title", value: "My Dashboard", valueType: "string", createdAt: "2024-03-10T09:00:31.000Z" },
  { id: "24000000-0000-0000-0000-000000000003", eventId: "23000000-0000-0000-0000-000000000002", key: "element_id", value: "btn-create-report", valueType: "string", createdAt: "2024-03-10T09:05:01.000Z" },
  { id: "24000000-0000-0000-0000-000000000004", eventId: "23000000-0000-0000-0000-000000000003", key: "page_url", value: "https://app.analytics.io/reports", valueType: "string", createdAt: "2024-03-11T14:00:31.000Z" },
  { id: "24000000-0000-0000-0000-000000000005", eventId: "23000000-0000-0000-0000-000000000005", key: "funnel_id", value: "25000000-0000-0000-0000-000000000001", valueType: "string", createdAt: "2024-03-13T10:15:01.000Z" },
  { id: "24000000-0000-0000-0000-000000000006", eventId: "23000000-0000-0000-0000-000000000005", key: "step_order", value: "2", valueType: "number", createdAt: "2024-03-13T10:15:01.000Z" },
  { id: "24000000-0000-0000-0000-000000000007", eventId: "23000000-0000-0000-0000-000000000007", key: "export_format", value: "csv", valueType: "string", createdAt: "2024-03-15T09:45:01.000Z" },
  { id: "24000000-0000-0000-0000-000000000008", eventId: "23000000-0000-0000-0000-000000000008", key: "search_query", value: "monthly active users", valueType: "string", createdAt: "2024-03-16T16:05:01.000Z" },
  { id: "24000000-0000-0000-0000-000000000009", eventId: "23000000-0000-0000-0000-000000000009", key: "is_public", value: "true", valueType: "boolean", createdAt: "2024-03-18T08:30:01.000Z" },
  { id: "24000000-0000-0000-0000-00000000000a", eventId: "23000000-0000-0000-0000-000000000009", key: "share_url", value: "https://app.analytics.io/shared/abc123", valueType: "string", createdAt: "2024-03-18T08:30:01.000Z" },
] as const;
