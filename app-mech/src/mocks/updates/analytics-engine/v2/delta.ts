import type { ProjectV2Delta } from "../../types";

const delta: ProjectV2Delta = {
  tableRenames: [
    { from: "Property",   to: "EventAttribute", dbName: "event_attributes" },
    { from: "FunnelStep", to: "ConversionStep", dbName: "conversion_steps" },
  ],

  fieldRenames: [
    { table: "Session",    from: "ipAddress",   to: "clientIp" },
    { table: "DataSource", from: "config",      to: "settings" },
    { table: "User",       from: "anonymousId", to: "trackingId" },
  ],

  fieldTypeChanges: [
    { table: "FunnelStep", field: "conversionRate", logicalType: "decimal", nativeType: null },
    { table: "Event",      field: "payload",        logicalType: "string",  nativeType: null },
  ],

  removedRelations: [
    "PropertyToEvent",
    "EventToUser",
  ],

  removedRestrictions: [
    "property_key_per_event",
    "event_name_idx",
  ],
};

export default delta;
