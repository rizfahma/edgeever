import type { NamedTableView, TableCellValue, TableDocument, TableField, TableRecord } from "@edgeever/shared";

// Project-management layouts (board, calendar, timeline) for structured tables.
// Copy lives here with English defaults so the shared catalogs stay untouched.

export const DAY_MS = 86_400_000;

export const displayValue = (field: TableField, value: TableCellValue | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "checkbox") return value === true ? "✓" : "";
  if (Array.isArray(value)) return value.map((item) => item.filename).join(", ");
  return String(value);
};

/** The record's name: the first text field with a value, else the first non-empty field. */
export const recordTitle = (document: TableDocument, record: TableRecord): string => {
  const text = document.fields.find((field) => field.type === "text" && displayValue(field, record.cells[field.id]));
  if (text) return displayValue(text, record.cells[text.id]);
  const any = document.fields.find((field) => displayValue(field, record.cells[field.id]));
  return any ? displayValue(any, record.cells[any.id]) : "";
};

export const titleFieldId = (document: TableDocument) =>
  (document.fields.find((field) => field.type === "text") ?? document.fields[0])?.id;

/** Short secondary facts for a card: up to `limit` non-empty, compact fields. */
export const cardFacts = (document: TableDocument, record: TableRecord, exclude: Set<string>, limit = 3) => {
  const titleId = document.fields.find((field) => field.type === "text" && displayValue(field, record.cells[field.id]))?.id;
  const facts: { field: TableField; text: string }[] = [];
  for (const field of document.fields) {
    if (facts.length >= limit) break;
    if (field.id === titleId || exclude.has(field.id) || field.type === "attachment" || field.type === "url") continue;
    const text = displayValue(field, record.cells[field.id]);
    if (!text || text.length > 60) continue;
    facts.push({ field, text });
  }
  return facts;
};

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Local-midnight date for a YYYY-MM-DD string (no timezone drift). */
export const fromIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

export const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const todayIso = () => toIso(new Date());

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const dayDiff = (from: Date, to: Date) =>
  Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY_MS);

/** Monday-based start of the week. */
export const startOfWeek = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

/**
 * The date field a brand-new record should get today's date in, so it lands
 * where people look: the active view's date, its sorted date, or a field whose
 * name says it is the record's date.
 */
export const newRecordDateFieldId = (document: TableDocument, view: NamedTableView | undefined) => {
  const dates = document.fields.filter((field) => field.type === "date");
  if (!dates.length) return undefined;
  if (view?.dateFieldId && dates.some((field) => field.id === view.dateFieldId)) return view.dateFieldId;
  const sorted = view?.sorts.find((sort) => dates.some((field) => field.id === sort.fieldId));
  if (sorted) return sorted.fieldId;
  return dates.find((field) => /date|submitted|created|start|tanggal|tgl|raised/i.test(field.name)
    && !/last edited|updated|end|due/i.test(field.name))?.id;
};

export const layoutStatusTone = (value: string) => {
  const text = value.toLowerCase();
  if (/done|complete|closed|clean|resolved|selesai|deployed/.test(text)) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (/progress|ongoing|review|remediate|wip|berjalan/.test(text)) return "bg-amber-50 text-amber-800 border-amber-200";
  if (/reject|cancel|block|fail|overdue/.test(text)) return "bg-rose-50 text-rose-800 border-rose-200";
  if (/open|new|todo|to do|not started|backlog|pending/.test(text)) return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};
