// Carts 1-7 are authenticated; carts 8-10 are guest (null customerId).
export const carts = [
  { id: "50000000-0000-0000-0000-000000000001", customerId: "30000000-0000-0000-0000-000000000001", status: "converted", totalAmount: 149.99, expiresAt: null, createdAt: "2024-02-10T10:00:00.000Z", updatedAt: "2024-02-10T12:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000002", customerId: "30000000-0000-0000-0000-000000000002", status: "active", totalAmount: 329.00, expiresAt: "2024-06-01T00:00:00.000Z", createdAt: "2024-05-25T09:00:00.000Z", updatedAt: "2024-05-25T09:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000003", customerId: "30000000-0000-0000-0000-000000000003", status: "abandoned", totalAmount: 79.95, expiresAt: "2024-04-01T00:00:00.000Z", createdAt: "2024-03-25T14:00:00.000Z", updatedAt: "2024-03-25T14:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000004", customerId: "30000000-0000-0000-0000-000000000004", status: "converted", totalAmount: 164.49, expiresAt: null, createdAt: "2024-03-10T08:00:00.000Z", updatedAt: "2024-03-10T10:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000005", customerId: "30000000-0000-0000-0000-000000000005", status: "active", totalAmount: 119.00, expiresAt: "2024-06-15T00:00:00.000Z", createdAt: "2024-05-28T11:00:00.000Z", updatedAt: "2024-05-28T11:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000006", customerId: "30000000-0000-0000-0000-000000000007", status: "converted", totalAmount: 58.00, expiresAt: null, createdAt: "2024-04-05T09:30:00.000Z", updatedAt: "2024-04-05T11:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000007", customerId: "30000000-0000-0000-0000-00000000000a", status: "active", totalAmount: 91.99, expiresAt: "2024-06-20T00:00:00.000Z", createdAt: "2024-05-30T08:00:00.000Z", updatedAt: "2024-05-30T08:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000008", customerId: null, status: "abandoned", totalAmount: 34.50, expiresAt: "2024-04-10T00:00:00.000Z", createdAt: "2024-04-03T16:00:00.000Z", updatedAt: "2024-04-03T16:00:00.000Z" },
  { id: "50000000-0000-0000-0000-000000000009", customerId: null, status: "abandoned", totalAmount: 49.99, expiresAt: "2024-05-01T00:00:00.000Z", createdAt: "2024-04-24T13:00:00.000Z", updatedAt: "2024-04-24T13:00:00.000Z" },
  { id: "50000000-0000-0000-0000-00000000000a", customerId: null, status: "active", totalAmount: 0.00, expiresAt: "2024-07-01T00:00:00.000Z", createdAt: "2024-06-01T10:00:00.000Z", updatedAt: "2024-06-01T10:00:00.000Z" },
] as const;
