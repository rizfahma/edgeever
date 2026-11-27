import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NamedTableView, TableDocument, TableField, TableRecord } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { fromIso, isIsoDate, layoutStatusTone, recordTitle, todayIso } from "./layout-helpers";

// Dashboard layout: a read-mostly overview of the records in the current view.
// It reads the view's status select, date and breakdown select; every number
// is computed from the filtered records, so a dashboard view with filters
// summarizes exactly that slice.

type Props = {
  document: TableDocument;
  records: TableRecord[];
  view: NamedTableView;
  readOnly: boolean;
  onOpenRecord: (id: string) => void;
  onAddRecord: (preset: Record<string, string>) => void;
};

const DONE = /done|complete|closed|resolved|selesai|deployed|finished/i;
const PROGRESS = /progress|ongoing|review|remediat|wip|berjalan|doing/i;
const BLOCKED = /reject|cancel|block|fail|overdue|postpone/i;
const WAITING = /wait|hold|pending|menunggu/i;
// Informational states: neither work to do nor finished work.
const PARKED = /noted|info|fyi|archiv|cancel|reject|duplicate/i;

// Colours follow the active colour scheme (lib/color-schemes.ts) when one is set.
const ACCENT = {
  blue: "var(--edgeever-chart-1, #2563EB)", orange: "var(--edgeever-chart-2, #EA7A12)", green: "var(--edgeever-chart-3, #16A34A)",
  rose: "#E11D48", slate: "#94A3B8",
} as const;

const statusAccent = (label: string) => {
  if (DONE.test(label)) return ACCENT.green;
  if (PROGRESS.test(label)) return ACCENT.blue;
  if (PARKED.test(label)) return ACCENT.slate;
  if (BLOCKED.test(label)) return ACCENT.rose;
  if (WAITING.test(label)) return ACCENT.slate;
  return ACCENT.orange;
};

const hatch = (color: string): CSSProperties => ({
  backgroundColor: color,
  backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.28) 0 3px, transparent 3px 7px)",
});
const HATCH_TRACK: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, hsl(var(--border)) 0 3px, transparent 3px 7px)",
};

const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2000, month, 1));

const textOf = (record: TableRecord, field: TableField | undefined) => {
  if (!field) return "";
  const value = record.cells[field.id];
  return typeof value === "string" ? value : "";
};

function Panel({ title, subtitle, action, children, className = "" }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section aria-label={title} className={`min-w-0 rounded-xl border border-border bg-card p-4 ${className}`}>
      <header className="mb-3 flex items-start gap-2">
        <div className="min-w-0">
          <h3 className="edgeever-display text-[15px] font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

type Focus = { fieldId: string; value: string };
const LIST_PAGE = 15;

export function TableDashboardView({ document, records: allRecords, view, readOnly, onOpenRecord, onAddRecord }: Props) {
  const { t, i18n } = useTranslation();
  const statusField = document.fields.find((field) => field.id === view.groupFieldId && field.type === "select");
  const dateField = document.fields.find((field) => field.id === view.dateFieldId && field.type === "date")
    ?? document.fields.find((field) => field.type === "date");
  const viewBreakdownField = document.fields.find((field) => field.id === view.breakdownFieldId && field.type === "select");
  const valueField = document.fields.find((field) => field.id === view.valueFieldId && field.type === "number");
  // Clicking a status or a breakdown row focuses the whole dashboard on it:
  // every card, chart and list then describes just those records.
  const [focus, setFocus] = useState<Focus | null>(null);
  const [listLimit, setListLimit] = useState(LIST_PAGE);
  const focusField = focus ? document.fields.find((field) => field.id === focus.fieldId) : undefined;
  const records = useMemo(() => (focus && focusField
    ? allRecords.filter((record) => textOf(record, focusField) === focus.value)
    : allRecords), [allRecords, focus, focusField]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusOn = (fieldId: string, value: string) => {
    setFocus({ fieldId, value });
    setListLimit(LIST_PAGE);
    scrollRef.current?.scrollTo({ top: 0 });
  };
  // Focused on the breakdown itself, break the slice down by the next pick-list column instead.
  const breakdownField = focus && viewBreakdownField && focus.fieldId === viewBreakdownField.id
    ? document.fields.find((field) => field.type === "select" && field.id !== statusField?.id && field.id !== viewBreakdownField.id)
    : viewBreakdownField;
  const today = todayIso();
  const monthKey = today.slice(0, 7);
  const lastMonthKey = (() => {
    const date = fromIso(`${monthKey}-01`);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  })();

  const dated = useMemo(() => records
    .map((record) => ({ record, date: dateField ? record.cells[dateField.id] : undefined }))
    .filter((item): item is { record: TableRecord; date: string } => isIsoDate(item.date)), [records, dateField]);

  const years = useMemo(() => [...new Set(dated.map((item) => Number(item.date.slice(0, 4))))].sort((a, b) => a - b), [dated]);
  const thisYear = Number(today.slice(0, 4));
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const year = pickedYear ?? (years.includes(thisYear) ? thisYear : years.at(-1) ?? thisYear);
  const yearIndex = years.indexOf(year);
  const [breakdownScope, setBreakdownScope] = useState<"year" | "all">("year");

  const stats = useMemo(() => {
    const isDone = (record: TableRecord) => DONE.test(textOf(record, statusField));
    const isOpen = (record: TableRecord) => {
      const status = textOf(record, statusField);
      return !DONE.test(status) && !PARKED.test(status);
    };
    const done = statusField ? records.filter(isDone).length : 0;
    const open = statusField ? records.filter(isOpen).length : 0;
    const thisMonth = dated.filter((item) => item.date.startsWith(monthKey)).length;
    const lastMonth = dated.filter((item) => item.date.startsWith(lastMonthKey)).length;
    const upcoming = dated.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const overdue = statusField ? dated.filter((item) => item.date < today && isOpen(item.record)).length : 0;
    return { done, open, thisMonth, lastMonth, upcoming, overdue };
  }, [records, dated, statusField, monthKey, lastMonthKey, today]);

  const workload = useMemo(() => {
    if (!statusField) return [];
    const counts = new Map<string, number>((statusField.options ?? []).map((option) => [option, 0]));
    for (const record of records) {
      const value = textOf(record, statusField);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count, color: statusAccent(label) }));
  }, [records, statusField]);

  const months = useMemo(() => {
    const counts = Array(12).fill(0) as number[];
    for (const item of dated) if (Number(item.date.slice(0, 4)) === year) counts[Number(item.date.slice(5, 7)) - 1]! += 1;
    const max = Math.max(1, ...counts);
    return counts.map((count, index) => ({
      count, height: Math.round((count / max) * 100),
      label: MONTHS[index]!.toLocaleDateString(i18n.language, { month: "short" }),
      current: year === thisYear && index === Number(monthKey.slice(5, 7)) - 1,
      future: year > thisYear || (year === thisYear && index > Number(monthKey.slice(5, 7)) - 1),
    }));
  }, [dated, year, thisYear, monthKey, i18n.language]);

  const breakdown = useMemo(() => {
    if (!breakdownField) return [];
    const source = breakdownScope === "all" || !dateField
      ? records
      : dated.filter((item) => Number(item.date.slice(0, 4)) === year).map((item) => item.record);
    const counts = new Map<string, number>();
    for (const record of source) {
      const value = textOf(record, breakdownField);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(1, ...rows.map(([, count]) => count));
    return rows.map(([label, count], index) => ({ label, count, width: Math.max(3, Math.round((count / max) * 100)), lead: index === 0 }));
  }, [breakdownField, breakdownScope, dateField, records, dated, year]);

  const recentLimit = focus ? listLimit : 6;
  const recentAll = useMemo(() => (dateField
    ? dated.filter((item) => item.date <= today).sort((a, b) => b.date.localeCompare(a.date))
    : records.map((record) => ({ record, date: "" }))), [dated, dateField, records, today]);
  const recent = recentAll.slice(0, recentLimit);

  const metric = useMemo(() => {
    if (!valueField) return null;
    // One point per date: records that share a date (several stages of the
    // same week, say) are averaged, so a focused slice shows its own line.
    const byDate = new Map<string, { record: TableRecord; date: string; total: number; count: number }>();
    for (const item of dated) {
      const value = item.record.cells[valueField.id];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const point = byDate.get(item.date);
      if (point) { point.total += value; point.count += 1; }
      else byDate.set(item.date, { record: item.record, date: item.date, total: value, count: 1 });
    }
    const points = [...byDate.values()]
      .map((point) => ({ record: point.record, date: point.date, value: Math.round((point.total / point.count) * 100) / 100, count: point.count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!points.length) return { points: [], latest: null, previous: null, average: null, min: 0, max: 0, averaged: false };
    const shown = points.slice(-16);
    const values = shown.map((point) => point.value);
    const min = Math.min(0, ...values);
    const max = Math.max(...values, min + 1);
    return {
      points: shown, latest: points.at(-1)!, previous: points.at(-2) ?? null,
      average: values.reduce((sum, value) => sum + value, 0) / values.length, min, max,
      averaged: shown.some((point) => point.count > 1),
    };
  }, [valueField, dated]);
  const upcoming = stats.upcoming.slice(0, 6);

  const formatDate = (iso: string) => (iso ? fromIso(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" }) : "");
  const untitled = t("pmViews.untitled", { defaultValue: "Untitled" });
  const formatNumber = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const delta = stats.thisMonth - stats.lastMonth;

  const cards = [
    {
      label: t("pmViews.dashRecords", { defaultValue: "Records" }), value: records.length,
      note: dateField ? t("pmViews.dashThisMonth", { defaultValue: "{{count}} this month", count: stats.thisMonth }) : "",
      tone: delta >= 0 ? ACCENT.green : undefined,
    },
    {
      label: t("pmViews.dashUpcoming", { defaultValue: "Coming up" }), value: stats.upcoming.length,
      note: stats.upcoming[0] ? t("pmViews.dashNext", { defaultValue: "Next on {{date}}", date: formatDate(stats.upcoming[0].date) }) : t("pmViews.dashNothing", { defaultValue: "Nothing scheduled" }),
      tone: ACCENT.blue,
    },
    {
      label: t("pmViews.dashOpen", { defaultValue: "Open" }), value: statusField ? stats.open : "–",
      note: statusField && dateField ? t("pmViews.dashOverdue", { defaultValue: "{{count}} past their date", count: stats.overdue }) : "",
      tone: stats.overdue ? ACCENT.orange : undefined,
    },
    {
      label: t("pmViews.dashDone", { defaultValue: "Done" }), value: statusField ? stats.done : "–",
      note: statusField && records.length ? t("pmViews.dashShare", { defaultValue: "{{percent}}% of all", percent: Math.round((stats.done / records.length) * 100) }) : "",
      tone: ACCENT.green,
    },
  ];

  const recordRow = (item: { record: TableRecord; date: string }, showStatus: boolean) => {
    const status = textOf(item.record, statusField);
    const group = textOf(item.record, breakdownField);
    return (
      <li key={item.record.id}>
        <button type="button" onClick={() => onOpenRecord(item.record.id)}
          className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex w-11 shrink-0 flex-col items-center rounded-md border border-border bg-background py-1 text-center leading-none">
            <span className="text-[10px] uppercase text-muted-foreground">{item.date ? fromIso(item.date).toLocaleDateString(i18n.language, { month: "short" }) : ""}</span>
            <span className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{item.date ? Number(item.date.slice(8, 10)) : "–"}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{recordTitle(document, item.record) || untitled}</span>
            {group && <span className="block truncate text-xs text-muted-foreground">{group}</span>}
          </span>
          {showStatus && status && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${layoutStatusTone(status)}`}>{status}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div ref={scrollRef} className="edgeever-dashboard min-h-0 flex-1 overflow-y-auto bg-muted/20">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-4 sm:p-5">
        {focus && focusField && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setFocus(null)}>
              <ArrowLeft className="size-3.5" /> {t("pmViews.dashBack", { defaultValue: "Whole table" })}
            </Button>
            <span className="text-sm text-muted-foreground">{focusField.name}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-sm font-medium ${layoutStatusTone(focus.value)}`}>{focus.value}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {t("pmViews.dashFocusCount", { defaultValue: "{{count}} records", count: records.length })}
            </span>
            <Button type="button" size="icon" variant="ghost" className="ml-auto size-8"
              aria-label={t("pmViews.dashClearFocus", { defaultValue: "Show the whole table" })} onClick={() => setFocus(null)}>
              <X className="size-4" />
            </Button>
          </div>
        )}
        {metric && valueField && (
          <Panel title={t("pmViews.dashMetric", { defaultValue: "{{field}} over time", field: valueField.name })}
            subtitle={metric.latest ? [
              t("pmViews.dashMetricNote", { defaultValue: "Latest {{value}} on {{date}} · average {{average}}", value: formatNumber(metric.latest.value), date: formatDate(metric.latest.date), average: formatNumber(metric.average ?? 0) }),
              metric.averaged ? t("pmViews.dashMetricAveraged", { defaultValue: "records on the same date are averaged; pick a row in the breakdown to see one" }) : "",
            ].filter(Boolean).join(" · ") : undefined}
            action={metric.latest && metric.previous ? (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums"
                style={{ color: metric.latest.value >= metric.previous.value ? ACCENT.green : ACCENT.orange }}>
                {metric.latest.value >= metric.previous.value ? "▲" : "▼"} {formatNumber(Math.abs(metric.latest.value - metric.previous.value))}
              </span>
            ) : undefined}>
            {metric.points.length ? (
              <>
                <div className="flex h-40 items-end gap-1.5 border-b border-border" role="img"
                  aria-label={metric.points.map((point) => `${point.date} ${point.value}`).join(", ")}>
                  {metric.points.map((point, index) => (
                    <button key={point.record.id} type="button" onClick={() => onOpenRecord(point.record.id)}
                      aria-label={`${formatDate(point.date)}: ${formatNumber(point.value)}`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{formatNumber(point.value)}</span>
                      <span className="w-full max-w-9 rounded-t-[5px]"
                        style={{ height: `${Math.max(3, ((point.value - metric.min) / (metric.max - metric.min)) * 80)}%`, ...hatch(index === metric.points.length - 1 ? ACCENT.orange : ACCENT.blue) }} />
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {metric.points.map((point) => (
                    <span key={point.record.id} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
                      {fromIso(point.date).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })}
                    </span>
                  ))}
                </div>
              </>
            ) : <p className="py-6 text-center text-sm text-muted-foreground">{t("pmViews.dashMetricEmpty", { defaultValue: "No values yet. Add a record with a date and a number." })}</p>}
          </Panel>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="edgeever-display mt-1.5 text-[28px] font-semibold leading-none tabular-nums text-foreground">{card.value}</p>
              {card.note && <p className="mt-1.5 truncate text-xs text-muted-foreground" style={card.tone ? { color: card.tone } : undefined}>{card.note}</p>}
            </div>
          ))}
        </div>

        {statusField ? (
          <Panel title={t("pmViews.dashWorkload", { defaultValue: "Workload by {{field}}", field: statusField.name })}
            action={!readOnly && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onAddRecord({})}>
                <Plus className="size-3.5" /> {t("pmViews.dashNew", { defaultValue: "New" })}
              </Button>
            )}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2">
              {workload.map((item) => (
                <button key={item.label} type="button" onClick={() => focusOn(statusField.id, item.label)}
                  aria-pressed={focus?.fieldId === statusField.id && focus.value === item.label}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums text-foreground"
                    style={{ border: `3px ${WAITING.test(item.label) || PARKED.test(item.label) ? "dashed" : "solid"} ${item.count ? item.color : "hsl(var(--border))"}` }}>
                    {item.count}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {dateField && (
            <Panel title={t("pmViews.dashByMonth", { defaultValue: "By month" })}
              subtitle={t("pmViews.dashByMonthNote", { defaultValue: "{{field}} in {{year}}", field: dateField.name, year })}
              action={(
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" className="size-7" disabled={yearIndex <= 0}
                    aria-label={t("pmViews.dashPrevYear", { defaultValue: "Previous year" })}
                    onClick={() => setPickedYear(years[yearIndex - 1] ?? year)}><ChevronLeft className="size-4" /></Button>
                  <span className="w-10 text-center text-sm font-medium tabular-nums">{year}</span>
                  <Button type="button" size="icon" variant="ghost" className="size-7" disabled={yearIndex < 0 || yearIndex >= years.length - 1}
                    aria-label={t("pmViews.dashNextYear", { defaultValue: "Next year" })}
                    onClick={() => setPickedYear(years[yearIndex + 1] ?? year)}><ChevronRight className="size-4" /></Button>
                </div>
              )}>
              <div className="flex h-44 items-end gap-1.5 border-b border-border" role="img"
                aria-label={months.map((month) => `${month.label} ${month.count}`).join(", ")}>
                {months.map((month) => (
                  <div key={month.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{month.count || ""}</span>
                    <div className="w-full max-w-8 rounded-t-[5px]"
                      style={month.count ? { height: `${Math.max(3, month.height * 0.82)}%`, ...hatch(month.current ? ACCENT.orange : month.future ? "color-mix(in srgb, var(--edgeever-chart-1, #2563EB) 45%, white)" : ACCENT.blue) } : { height: 2, ...HATCH_TRACK }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {months.map((month) => (
                  <span key={month.label} className={`min-w-0 flex-1 truncate text-center text-[10px] ${month.current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{month.label}</span>
                ))}
              </div>
            </Panel>
          )}

          {breakdownField && (
            <Panel title={t("pmViews.dashBreakdown", { defaultValue: "By {{field}}", field: breakdownField.name })}
              subtitle={breakdownScope === "year" && dateField ? String(year) : t("pmViews.dashAllTime", { defaultValue: "All records" })}
              action={dateField && (
                <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label={t("pmViews.dashScope", { defaultValue: "Range" })}>
                  {(["year", "all"] as const).map((scope) => (
                    <button key={scope} type="button" aria-pressed={breakdownScope === scope} onClick={() => setBreakdownScope(scope)}
                      className={`rounded px-2 py-1 ${breakdownScope === scope ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {scope === "year" ? year : t("pmViews.dashAll", { defaultValue: "All" })}
                    </button>
                  ))}
                </div>
              )}>
              {breakdown.length ? (
                <ul className="flex flex-col gap-2.5">
                  {breakdown.map((row) => (
                    <li key={row.label}>
                      <button type="button" onClick={() => focusOn(breakdownField.id, row.label)}
                        aria-label={t("pmViews.dashOpenSlice", { defaultValue: "Show {{value}}", value: row.label })}
                        className="grid w-full grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-md px-1 py-0.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="truncate text-foreground underline-offset-2 group-hover:underline">{row.label}</span>
                      <span className="h-3.5 overflow-hidden rounded" style={HATCH_TRACK}>
                        <span className="block h-full rounded" style={{ width: `${row.width}%`, ...hatch(row.lead ? ACCENT.orange : ACCENT.blue) }} />
                      </span>
                      <span className="text-right font-medium tabular-nums">{row.count}</span>
                    </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="py-6 text-center text-sm text-muted-foreground">{t("pmViews.dashEmpty", { defaultValue: "No records here yet." })}</p>}
            </Panel>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title={t("pmViews.dashRecent", { defaultValue: "Recent" })}
            subtitle={dateField ? t("pmViews.dashRecentNote", { defaultValue: "Latest by {{field}}", field: dateField.name }) : undefined}>
            {recent.length
              ? (
                <>
                  <ol className="-mx-2 flex flex-col">{recent.map((item) => recordRow(item, true))}</ol>
                  {focus && recentAll.length > recent.length && (
                    <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setListLimit((limit) => limit + LIST_PAGE)}>
                      {t("pmViews.showMore", { defaultValue: "Show {{count}} more", count: Math.min(LIST_PAGE, recentAll.length - recent.length) })}
                    </Button>
                  )}
                </>
              )
              : <p className="py-6 text-center text-sm text-muted-foreground">{t("pmViews.dashEmpty", { defaultValue: "No records here yet." })}</p>}
          </Panel>
          {dateField && (
            <Panel title={t("pmViews.dashUpcomingTitle", { defaultValue: "Upcoming" })}
              subtitle={t("pmViews.dashUpcomingNote", { defaultValue: "From today by {{field}}", field: dateField.name })}>
              {upcoming.length
                ? <ol className="-mx-2 flex flex-col">{upcoming.map((item) => recordRow(item, false))}</ol>
                : <p className="py-6 text-center text-sm text-muted-foreground">{t("pmViews.dashNothing", { defaultValue: "Nothing scheduled" })}</p>}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
