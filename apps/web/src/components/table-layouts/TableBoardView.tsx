import { useMemo, useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateTableCell, type NamedTableView, type TableDocument, type TableRecord } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { cardFacts, layoutStatusTone, recordTitle } from "./layout-helpers";

type Props = {
  document: TableDocument;
  records: TableRecord[];
  view: NamedTableView;
  readOnly: boolean;
  onChange: (next: TableDocument) => void;
  onOpenRecord: (id: string) => void;
  onAddRecord: (preset: Record<string, string>) => void;
};

const COLUMN_PAGE = 60;
const EMPTY_KEY = "\u0000none";

export function TableBoardView({ document, records, view, readOnly, onChange, onOpenRecord, onAddRecord }: Props) {
  const { t } = useTranslation();
  const field = document.fields.find((item) => item.id === view.groupFieldId && item.type === "select")
    ?? document.fields.find((item) => item.type === "select");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const columns = useMemo(() => {
    if (!field) return [];
    const options = field.options ?? [];
    const groups = new Map<string, TableRecord[]>([[EMPTY_KEY, []], ...options.map((option) => [option, []] as [string, TableRecord[]])]);
    for (const record of records) {
      const value = record.cells[field.id];
      const key = typeof value === "string" && value ? value : EMPTY_KEY;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }
    // Options first in their defined order, then unexpected values, then "no value" if used.
    const ordered = [...options, ...[...groups.keys()].filter((key) => key !== EMPTY_KEY && !options.includes(key))];
    const result = ordered.map((key) => ({ key, label: key, records: groups.get(key) ?? [] }));
    const empty = groups.get(EMPTY_KEY)!;
    return empty.length ? [{ key: EMPTY_KEY, label: t("pmViews.noValue", { defaultValue: "No {{field}}", field: field.name }), records: empty }, ...result] : result;
  }, [field, records, t]);

  if (!field) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("pmViews.boardNeedsSelect", { defaultValue: "A board groups cards by a pick-list column. Add a select column (for example Status) to use this view." })}
      </p>
    );
  }

  const exclude = new Set([field.id]);
  const move = (recordId: string, key: string) => {
    const value = key === EMPTY_KEY ? "" : key;
    const record = document.records.find((item) => item.id === recordId);
    if (!record || (record.cells[field.id] ?? "") === value) return;
    onChange(updateTableCell(document, recordId, field.id, value));
  };
  const onDrop = (event: DragEvent, key: string) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/x-edgeever-record");
    if (id && !readOnly) move(id, key);
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden bg-muted/20 p-3">
      {columns.map((column) => {
        const showAll = expanded.has(column.key);
        const visible = showAll ? column.records : column.records.slice(0, COLUMN_PAGE);
        return (
          <section key={column.key} aria-label={column.label}
            className={`flex max-h-full w-72 shrink-0 flex-col rounded-lg border bg-card ${dragOver === column.key ? "border-foreground/40 ring-2 ring-ring/30" : "border-border"}`}
            onDragOver={(event) => { if (!readOnly) { event.preventDefault(); setDragOver(column.key); } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(event) => onDrop(event, column.key)}>
            <header className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className={`truncate rounded-md border px-2 py-0.5 text-xs font-medium ${column.key === EMPTY_KEY ? "border-dashed border-border text-muted-foreground" : layoutStatusTone(column.label)}`}>
                {column.label}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{column.records.length}</span>
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon" className="ml-auto size-7"
                  aria-label={t("pmViews.addToColumn", { defaultValue: "Add a record to {{column}}", column: column.label })}
                  onClick={() => onAddRecord(column.key === EMPTY_KEY ? {} : { [field.id]: column.key })}>
                  <Plus className="size-4" />
                </Button>
              )}
            </header>
            <ol className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {visible.map((record) => {
                const facts = cardFacts(document, record, exclude);
                return (
                  <li key={record.id}>
                    <div role="button" tabIndex={0} draggable={!readOnly}
                      onDragStart={(event) => { event.dataTransfer.setData("text/x-edgeever-record", record.id); event.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => onOpenRecord(record.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenRecord(record.id); } }}
                      className="w-full cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing">
                      <span className="line-clamp-3 block text-sm font-medium text-foreground">
                        {recordTitle(document, record) || t("pmViews.untitled", { defaultValue: "Untitled" })}
                      </span>
                      {facts.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {facts.map(({ field: fact, text }) => (
                            <span key={fact.id} className={`max-w-full truncate rounded border px-1.5 py-0.5 text-[11px] ${fact.type === "select" ? layoutStatusTone(text) : "border-border text-muted-foreground"}`}>
                              {fact.type === "date" || fact.type === "select" ? text : `${fact.name}: ${text}`}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {column.records.length > visible.length && (
                <li>
                  <Button type="button" variant="ghost" size="sm" className="w-full"
                    onClick={() => setExpanded((current) => new Set(current).add(column.key))}>
                    {t("pmViews.showMore", { defaultValue: "Show {{count}} more", count: column.records.length - visible.length })}
                  </Button>
                </li>
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
