// MySQL char(36) UUIDs. anonymousId/email/name/country are all nullable.
export const users = [
  { id: "21000000-0000-0000-0000-000000000001", anonymousId: null, email: "alice@acme.com", name: "Alice Chen", country: "US", isIdentified: true, createdAt: "2024-01-05T08:00:00.000Z", updatedAt: "2024-03-10T09:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000002", anonymousId: "anon-f1a2b3c4", email: "ben.wright@startco.io", name: "Ben Wright", country: "GB", isIdentified: true, createdAt: "2024-01-10T09:00:00.000Z", updatedAt: "2024-01-10T09:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000003", anonymousId: "anon-d5e6f7a8", email: null, name: null, country: "DE", isIdentified: false, createdAt: "2024-01-12T10:00:00.000Z", updatedAt: "2024-01-12T10:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000004", anonymousId: null, email: "riya.patel@deepdata.ai", name: "Riya Patel", country: "IN", isIdentified: true, createdAt: "2024-01-15T08:00:00.000Z", updatedAt: "2024-02-20T10:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000005", anonymousId: "anon-b9c0d1e2", email: null, name: null, country: null, isIdentified: false, createdAt: "2024-01-20T11:00:00.000Z", updatedAt: "2024-01-20T11:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000006", anonymousId: null, email: "luca.ferrari@studio.it", name: "Luca Ferrari", country: "IT", isIdentified: true, createdAt: "2024-02-01T09:00:00.000Z", updatedAt: "2024-04-05T10:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000007", anonymousId: "anon-a3b4c5d6", email: "jane.doe@corp.com", name: "Jane Doe", country: "CA", isIdentified: true, createdAt: "2024-02-10T08:00:00.000Z", updatedAt: "2024-02-10T08:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000008", anonymousId: "anon-e7f8a9b0", email: null, name: null, country: "FR", isIdentified: false, createdAt: "2024-02-15T13:00:00.000Z", updatedAt: "2024-02-15T13:00:00.000Z" },
  { id: "21000000-0000-0000-0000-000000000009", anonymousId: null, email: "hiro.tanaka@techfirm.jp", name: "Hiro Tanaka", country: "JP", isIdentified: true, createdAt: "2024-03-01T08:00:00.000Z", updatedAt: "2024-04-10T10:00:00.000Z" },
  { id: "21000000-0000-0000-0000-00000000000a", anonymousId: "anon-c1d2e3f4", email: null, name: null, country: null, isIdentified: false, createdAt: "2024-03-15T14:00:00.000Z", updatedAt: "2024-03-15T14:00:00.000Z" },
] as const;
