import user from "./user";
import session from "./session";
import event from "./event";
import property from "./property";
import funnel from "./funnel";
import funnelStep from "./funnel-step";
import dataSource from "./data-source";
import dashboard from "./dashboard";
import widget from "./widget";
import report from "./report";
import type { MockTableDef } from "../../types";

export const analyticsEngineTables: MockTableDef[] = [
  user,
  session,
  event,
  property,
  funnel,
  funnelStep,
  dataSource,
  dashboard,
  widget,
  report,
];
