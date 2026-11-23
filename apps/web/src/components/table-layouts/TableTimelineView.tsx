import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { updateTableCell, type NamedTableView, type TableDocument, type TableRecord } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { addDays, dayDiff, fromIso, isIsoDate, layoutStatusTone, recordTitle, startOfWeek, toIso } from "./layout-helpers";

type Props = {
  document: TableDocument;
  records: TableRecord[];
  view: NamedTableView;
  readOnly: boolean;
  onChange: (next: TableDocument) => void;
  onOpenRecord: (id: string) => void;
};

const ZOOMS = { day: 36, week: 14, month: 4 } as const;
type Zoom = keyof typeof ZOOMS;
const ROW = 34;
const LABEL = 240;
const MAX_DAYS = 1600;
type Drag = { id: string; mode: "move" | "end"; originX: number; delta: number; moved: boolean };

export function TableTimelineView({ document, records, view, readOnly, onChange, onOpenRecord }: Props) {
  const { t, i18n } = useTranslation();
  const startField = document.fields.find((item) => item.id === view.dateFieldId && item.type === "date")
    ?? document.fields.find((item) => item.type === "date");
  const endField = startField
    ? document.fields.find((item) => item.id === view.endDateFieldId && item.type === "date" && item.id !== startField.id)
    : undefined;
  const statusField = document.fields.find((item) => item.type === "select");
  const [zoom, setZoom] = useState<Zoom>("week");
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const px = ZOOMS[zoom];

  const rows = useMemo(() => {
    if (!startField) return [];
    return records.flatMap((record) => {
      const start = record.cells[startField.id];
      if (!isIsoDate(start)) return [];
      const endRaw = endField ? record.cells[endField.id] : null;
      const end = isIsoDate(endRaw) && endRaw >= start ? endRaw : start;
      return [{ record, start, end }];
    });
  }, [endField, records, startField]);

  const range = useMemo(() => {
    const today = new Date();
    let min = addDays(today, -30);
    let max = addDays(today, 60);
    for (const row of rows) {
      const start = fromIso(row.start);
      const end = fromIso(row.end);
      if (start < min) min = start;
      if (end > max) max = end;
    }
    let from = startOfWeek(addDays(min, -7));
    const to = addDays(max, 21);
    if (dayDiff(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
    return { from, days: dayDiff(from, to) + 1 };
  }, [rows]);

  const todayOffset = dayDiff(range.from, new Date());
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = Math.max(0, todayOffset * px - (element.clientWidth - LABEL) / 3);
  }, [px, todayOffset]);

  if (!startField) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("pmViews.timelineNeedsDate", { defaultValue: "A timeline draws bars from date columns. Add a start date column (and optionally an end date) to use this view." })}
      </p>
    );
  }

  const locale = i18n.resolvedLanguage || undefined;
  const width = range.days * px;
  const months: { left: number; label: string }[] = [];
  for (let cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1); dayDiff(range.from, cursor) < range.days; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    months.push({
      left: Math.max(0, dayDiff(range.from, cursor)) * px,
      label: cursor.toLocaleDateString(locale, zoom === "month" ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" }),
    });
  }
  const todayKey = toIso(new Date());
  const ticks = zoom === "day"
    ? Array.from({ length: range.days }, (_, index) => { const day = addDays(range.from, index); return { left: index * px, label: String(day.getDate()), today: toIso(day) === todayKey }; })
    : Array.from({ length: Math.ceil(range.days / 7) }, (_, index) => { const day = addDays(range.from, index * 7); return { left: index * 7 * px, label: String(day.getDate()), today: false }; });
  const weekBackground = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${7 * px - 1}px, hsl(var(--border) / 0.7) ${7 * px - 1}px, hsl(var(--border) / 0.7) ${7 * px}px)`,
  };

  const commit = (current: Drag) => {
    const row = rows.find((item) => item.record.id === current.id);
    if (!row || !current.delta) return;
    if (current.mode === "move") {
      let next = updateTableCell(document, row.record.id, startField.id, toIso(addDays(fromIso(row.start), current.delta)));
      if (endField && isIsoDate(row.record.cells[endField.id])) {
        next = updateTableCell(next, row.record.id, endField.id, toIso(addDays(fromIso(row.end), current.delta)));
      }
      onChange(next);
    } else if (endField) {
      const end = addDays(fromIso(row.end), current.delta);
      onChange(updateTableCell(document, row.record.id, endField.id, toIso(end < fromIso(row.start) ? fromIso(row.start) : end)));
    }
  };

  const beginDrag = (event: ReactPointerEvent, id: string, mode: Drag["mode"]) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const next = { id, mode, originX: event.clientX, delta: 0, moved: false };
    dragRef.current = next;
    setDrag(next);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent) => {
    const current = dragRef.current;
    if (!current) return;
    const delta = Math.round((event.clientX - current.originX) / px);
    const moved = current.moved || Math.abs(event.clientX - current.originX) > 4;
    if (delta === current.delta && moved === current.moved) return;
    const next = { ...current, delta: readOnly ? 0 : delta, moved };
    dragRef.current = next;
    setDrag(next);
  };
  const endDrag = (id: string) => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;
    if (!current.moved) onOpenRecord(id);
    else if (!readOnly) commit(current);
  };

  const undated = records.length - rows.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" variant="outline" size="sm"
          onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayOffset * px - (scrollRef.current.clientWidth - LABEL) / 3); }}>
          {t("pmViews.today", { defaultValue: "Today" })}
        </Button>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={t("pmViews.zoom", { defaultValue: "Zoom" })}>
          {(Object.keys(ZOOMS) as Zoom[]).map((item) => (
            <button key={item} type="button" aria-pressed={zoom === item} onClick={() => setZoom(item)}
              className="rounded px-2 py-0.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground">
              {t(`pmViews.zoom_${item}`, { defaultValue: item === "day" ? "Days" : item === "week" ? "Weeks" : "Months" })}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {endField ? `${startField.name} → ${endField.name}` : startField.name}
          {undated ? ` · ${t("pmViews.undatedStart", { defaultValue: "{{count}} without a start date", count: undated })}` : ""}
        </span>
      </div>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL + width, minHeight: "100%" }}>
          <div className="sticky top-0 z-20 flex h-12 border-b border-border bg-card">
            <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground" style={{ width: LABEL }}>
              {t("pmViews.records", { defaultValue: "{{count}} records", count: rows.length })}
            </div>
            <div className="relative" style={{ width }}>
              {months.map((month) => (
                <span key={month.left} className="absolute top-0 h-6 border-l border-border px-1.5 py-1 text-xs font-medium capitalize text-foreground" style={{ left: month.left }}>
                  {month.label}
                </span>
              ))}
              {zoom !== "month" && ticks.map((tick) => (
                <span key={tick.left} className={`absolute bottom-0 h-6 py-1 text-center text-[11px] tabular-nums ${tick.today ? "font-semibold text-rose-600" : "text-muted-foreground"}`}
                  style={{ left: tick.left, width: zoom === "day" ? px : 7 * px }}>
                  {tick.label}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0" style={{ left: LABEL, width, ...weekBackground }} />
            {todayOffset >= 0 && todayOffset < range.days && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-500/70" style={{ left: LABEL + todayOffset * px + px / 2 }} />
            )}
            {rows.map(({ record, start, end }) => {
              const active = drag?.id === record.id ? drag : null;
              const startOffset = dayDiff(range.from, fromIso(start)) + (active?.mode === "move" ? active.delta : 0);
              const length = Math.max(1, dayDiff(fromIso(start), fromIso(end)) + 1 + (active?.mode === "end" ? active.delta : 0));
              const barWidth = Math.max(8, length * px - 2);
              const title = recordTitle(document, record) || t("pmViews.untitled", { defaultValue: "Untitled" });
              const status = statusField ? record.cells[statusField.id] : null;
              const tone = typeof status === "string" && status ? layoutStatusTone(status) : "border-slate-300 bg-slate-100 text-slate-800";
              return (
                <div key={record.id} className="relative flex border-b border-border/60 hover:bg-muted/20" style={{ height: ROW }}>
                  <button type="button" onClick={() => onOpenRecord(record.id)}
                    className="sticky left-0 z-10 shrink-0 truncate border-r border-border bg-card px-3 text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    style={{ width: LABEL }}>
                    {title}
                  </button>
                  <div className="relative" style={{ width }}>
                    <div
                      role="button" tabIndex={0}
                      aria-label={`${title}: ${start}${end !== start ? ` → ${end}` : ""}`}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenRecord(record.id); } }}
                      onPointerDown={(event) => beginDrag(event, record.id, "move")}
                      onPointerMove={moveDrag}
                      onPointerUp={() => endDrag(record.id)}
                      onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
                      className={`absolute top-1.5 flex h-[22px] touch-none select-none items-center overflow-hidden rounded border text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone} ${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${active?.moved ? "opacity-80 shadow-sm" : ""}`}
                      style={{ left: startOffset * px + 1, width: barWidth }}>
                      {barWidth > 48 && <span className="truncate px-1.5">{title}</span>}
                      {endField && !readOnly && (
                        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-black/10"
                          onPointerDown={(event) => beginDrag(event, record.id, "end")} />
                      )}
                    </div>
                    {barWidth <= 48 && (
                      <span className="pointer-events-none absolute top-1.5 truncate px-1.5 text-[11px] leading-[22px] text-muted-foreground" style={{ left: startOffset * px + barWidth + 2, maxWidth: 260 }}>
                        {title}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="sticky left-0 px-4 py-8 text-sm text-muted-foreground" style={{ width: LABEL + 320 }}>
                {t("pmViews.noDated", { defaultValue: "No records have a {{field}} yet.", field: startField.name })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

