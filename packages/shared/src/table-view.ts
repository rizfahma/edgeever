import type { TableCellValue, TableField, TableFilter, TableSort } from "./table";

export const DEFAULT_TABLE_VIEW_ID = "default";
export const TABLE_VIEW_SCHEMA_VERSION = 2 as const;
export const TABLE_VIEW_FILTER_LIMIT = 8;

const TEXT_OPERATORS = ["contains", "notContains", "eq", "neq", "empty", "notEmpty"] as const;
const COMPARISON_OPERATORS = ["eq", "neq", "lt", "lte", "gt", "gte"] as const;
const EMPTY_OPERATORS = ["empty", "notEmpty"] as const;

export const TABLE_VIEW_OPERATORS = {
  text: TEXT_OPERATORS,
  url: TEXT_OPERATORS,
  number: [...COMPARISON_OPERATORS, ...EMPTY_OPERATORS],
  date: ["eq", "lt", "gt", "between", "thisWeek", ...EMPTY_OPERATORS],
  select: ["eq", "neq", ...EMPTY_OPERATORS],
  checkbox: ["eq"],
  attachment: EMPTY_OPERATORS,
} as const;

export type TableViewOperator = (typeof TABLE_VIEW_OPERATORS)[keyof typeof TABLE_VIEW_OPERATORS][number];
export type TypedTableFilter = {
  fieldId: string;
  operator: TableViewOperator;
  value?: string | number | boolean;
  endValue?: string;
  legacy?: never;
};
export type TableViewFilter = TypedTableFilter | (TableFilter & { legacy: true });
export type TableViewSort = TableSort & { legacy?: true };
/** How a saved view presents its records. Missing means "table". */
export const TABLE_VIEW_LAYOUTS = ["table", "board", "calendar", "timeline", "dashboard"] as const;
export type TableViewLayout = (typeof TABLE_VIEW_LAYOUTS)[number];

export type NamedTableView = {
  id: string;
  /** Empty only for the inherited, localized default view. */
  name: string;
  match: "all" | "any";
  filters: TableViewFilter[];
  sorts: TableViewSort[];
  /** Board, calendar and timeline layouts. Omitted for the plain table. */
  layout?: Exclude<TableViewLayout, "table">;
  /** Board: select field whose options become the columns. Dashboard: the status field. */
  groupFieldId?: string;
  /** Calendar, timeline and dashboard: date field that places a record. */
  dateFieldId?: string;
  /** Timeline: optional end date field; bars are one day long without it. */
  endDateFieldId?: string;
  /** Dashboard: second select field broken down as bars (for example Workstream). */
  breakdownFieldId?: string;
  /** Dashboard: optional number field charted over time (for example a weekly score). */
  valueFieldId?: string;
};

/**
 * Keep only layout settings that still point at a field of the right type.
 * A stale reference (field deleted or retyped) falls back to the first
 * suitable field rather than invalidating the whole view.
 */
export const normalizeTableViewLayout = (view: Record<string, unknown>, fields: TableField[]): Pick<NamedTableView, "layout" | "groupFieldId" | "dateFieldId" | "endDateFieldId" | "breakdownFieldId" | "valueFieldId"> => {
  const layout = view.layout;
  if (layout !== "board" && layout !== "calendar" && layout !== "timeline" && layout !== "dashboard") return {};
  const ofType = (type: TableField["type"], id: unknown) =>
    fields.find((field) => field.id === id && field.type === type)?.id ?? fields.find((field) => field.type === type)?.id;
  if (layout === "board") {
    const groupFieldId = ofType("select", view.groupFieldId);
    return groupFieldId ? { layout, groupFieldId } : { layout };
  }
  if (layout === "dashboard") {
    const selects = fields.filter((field) => field.type === "select");
    const groupFieldId = selects.find((field) => field.id === view.groupFieldId)?.id
      ?? selects.find((field) => /status|state|stage/i.test(field.name))?.id ?? selects[0]?.id;
    const breakdownFieldId = selects.find((field) => field.id === view.breakdownFieldId && field.id !== groupFieldId)?.id
      ?? (view.breakdownFieldId === undefined ? undefined : selects.find((field) => field.id !== groupFieldId)?.id);
    const dateFieldId = ofType("date", view.dateFieldId);
    const valueFieldId = fields.find((field) => field.id === view.valueFieldId && field.type === "number")?.id;
    return {
      layout, ...(groupFieldId ? { groupFieldId } : {}), ...(dateFieldId ? { dateFieldId } : {}),
      ...(breakdownFieldId ? { breakdownFieldId } : {}), ...(valueFieldId ? { valueFieldId } : {}),
    };
  }
  const dateFieldId = ofType("date", view.dateFieldId);
  if (layout === "calendar") return dateFieldId ? { layout, dateFieldId } : { layout };
  const end = fields.find((field) => field.id === view.endDateFieldId && field.type === "date" && field.id !== dateFieldId)?.id;
  return { layout, ...(dateFieldId ? { dateFieldId } : {}), ...(end ? { endDateFieldId: end } : {}) };
};

export const tableFilterNeedsValue = (operator: TableViewOperator) =>
  operator !== "empty" && operator !== "notEmpty" && operator !== "thisWeek";

const isCalendarDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export const isValidTypedTableFilter = (field: TableField, filter: TypedTableFilter) => {
  if (!(TABLE_VIEW_OPERATORS[field.type] as readonly string[]).includes(filter.operator)) return false;
  if (!tableFilterNeedsValue(filter.operator)) return true;
  if (field.type === "checkbox") return typeof filter.value === "boolean";
  if (field.type === "number") return typeof filter.value === "number" && Number.isFinite(filter.value);
  if (field.type === "date") {
    if (!isCalendarDate(filter.value)) return false;
    return filter.operator !== "between" || (isCalendarDate(filter.endValue) && filter.endValue >= filter.value);
  }
  return typeof filter.value === "string" && filter.value.trim().length > 0;
};

const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const tableViewWeek = (now: Date) => {
  const start = new Date(now);
  start.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [localDayKey(start), localDayKey(end)] as const;
};

export const matchesTypedTableFilter = (
  field: TableField, value: TableCellValue, filter: TypedTableFilter, week: readonly [string, string] | undefined,
) => {
  const empty = value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const expected = filter.value;
  if (field.type === "date" && !isCalendarDate(value) && filter.operator !== "empty" && filter.operator !== "notEmpty") return false;
  switch (filter.operator) {
    case "empty": return empty;
    case "notEmpty": return !empty;
    case "eq": return value === expected;
    case "neq": return value !== expected;
    case "contains":
    case "notContains": {
      const contains = String(value ?? "").toLocaleLowerCase().includes(String(expected).trim().toLocaleLowerCase());
      return filter.operator === "contains" ? contains : !contains;
    }
    case "thisWeek": return Boolean(week && typeof value === "string" && value >= week[0] && value <= week[1]);
    case "between": return typeof value === "string" && typeof expected === "string"
      && value >= expected && value <= (filter.endValue ?? "");
    default: {
      if (empty) return false;
      if (typeof value === "number" && typeof expected === "number"
        || typeof value === "string" && typeof expected === "string") {
        if (filter.operator === "lt") return value < expected;
        if (filter.operator === "lte") return value <= expected;
        if (filter.operator === "gt") return value > expected;
        if (filter.operator === "gte") return value >= expected;
      }
      return false;
    }
  }
};
