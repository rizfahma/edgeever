import { useMemo, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateTableCell, type NamedTableView, type TableDocument, type TableRecord } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { addDays, fromIso, isIsoDate, layoutStatusTone, recordTitle, startOfWeek, toIso, todayIso } from "./layout-helpers";

type Props = {
  document: TableDocument;
  records: TableRecord[];
  view: NamedTableView;
  readOnly: boolean;
  onChange: (next: TableDocument) => void;
  onOpenRecord: (id: string) => void;
  onAddRecord: (preset: Record<string, string>) => void;
};

const PER_DAY = 3;

export function TableCalendarView({ document, records, view, readOnly, onChange, onOpenRecord, onAddRecord }: Props) {
  const { t, i18n } = useTranslation();
  const field = document.fields.find((item) => item.id === view.dateFieldId && item.type === "date")
    ?? document.fields.find((item) => item.type === "date");
  const statusField = document.fields.find((item) => item.type === "select");
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, TableRecord[]>();
    if (!field) return map;
    for (const record of records) {
      const value = record.cells[field.id];
      if (!isIsoDate(value)) continue;
      if (!map.has(value)) map.set(value, []);
      map.get(value)!.push(record);
    }
    return map;
  }, [field, records]);

  if (!field) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("pmViews.calendarNeedsDate", { defaultValue: "A calendar places records by a date column. Add a date column to use this view." })}
      </p>
    );
  }

  const undated = records.filter((record) => !isIsoDate(record.cells[field.id])).length;
  const first = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  const today = todayIso();
  const locale = i18n.resolvedLanguage || undefined;
  const monthLabel = month.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = days.slice(0, 7).map((day) => day.toLocaleDateString(locale, { weekday: "short" }));
  const shift = (delta: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const onDrop = (event: DragEvent, iso: string) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/x-edgeever-record");
    if (!id || readOnly) return;
    const record = document.records.find((item) => item.id === id);
    if (record && record.cells[field.id] !== iso) onChange(updateTableCell(document, id, field.id, iso));
  };

  const chip = (record: TableRecord) => {
    const status = statusField ? record.cells[statusField.id] : null;
    return (
      <button key={record.id} type="button" draggable={!readOnly}
        onDragStart={(event) => { event.dataTransfer.setData("text/x-edgeever-record", record.id); event.dataTransfer.effectAllowed = "move"; }}
        onClick={(event) => { event.stopPropagation(); setDayList(null); onOpenRecord(record.id); }}
        className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring ${typeof status === "string" && status ? layoutStatusTone(status) : "border-border bg-muted/40 text-foreground"}`}>
        {recordTitle(document, record) || t("pmViews.untitled", { defaultValue: "Untitled" })}
      </button>
    );
  };

  const listed = dayList ? byDay.get(dayList) ?? [] : [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }}>
          {t("pmViews.today", { defaultValue: "Today" })}
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t("pmViews.previous", { defaultValue: "Previous" })} onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t("pmViews.next", { defaultValue: "Next" })} onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {field.name}{undated ? ` · ${t("pmViews.undated", { defaultValue: "{{count}} without a date", count: undated })}` : ""}
        </span>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        {weekdays.map((label) => <div key={label} className="px-2 py-1.5">{label}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const iso = toIso(day);
          const items = byDay.get(iso) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          return (
            <div key={iso}
              className={`group relative flex min-h-24 flex-col gap-1 border-b border-r border-border p-1 ${inMonth ? "bg-card" : "bg-muted/30"} ${dragOver === iso ? "ring-2 ring-inset ring-ring/40" : ""}`}
              onDragOver={(event) => { if (!readOnly) { event.preventDefault(); setDragOver(iso); } }}
              onDragLeave={() => setDragOver((current) => current === iso ? null : current)}
              onDrop={(event) => onDrop(event, iso)}>
              <div className="flex items-center justify-between">
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${iso === today ? "bg-foreground font-semibold text-background" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </span>
                {!readOnly && (
                  <button type="button" onClick={() => onAddRecord({ [field.id]: iso })}
                    aria-label={t("pmViews.addOnDay", { defaultValue: "Add a record on {{date}}", date: iso })}
                    className="rounded p-0.5 text-muted-foreground opacity-0 outline-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100">
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>
              {items.slice(0, PER_DAY).map(chip)}
              {items.length > PER_DAY && (
                <button type="button" onClick={() => setDayList(iso)}
                  className="rounded px-1 text-left text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  {t("pmViews.more", { defaultValue: "+{{count}} more", count: items.length - PER_DAY })}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={Boolean(dayList)} onOpenChange={(open) => { if (!open) setDayList(null); }}>
        {dayList && (
          <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4">
            <DialogTitle className="text-base">{fromIso(dayList).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</DialogTitle>
            <DialogDescription className="sr-only">{field.name}</DialogDescription>
            <div className="grid max-h-[60vh] gap-1.5 overflow-y-auto">{listed.map(chip)}</div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
