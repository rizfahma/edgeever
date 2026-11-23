import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateTableCell, removeTableRecord, type TableDocument, type TableField } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resolveSafeTableUrl } from "@/lib/table-url";
import { displayValue, recordTitle } from "./layout-helpers";

type Props = {
  document: TableDocument;
  recordId: string | null;
  readOnly: boolean;
  onChange: (next: TableDocument) => void;
  onClose: () => void;
};

const fieldClass = "h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function FieldEditor({ field, value, readOnly, onCommit }: {
  field: TableField; value: string | boolean; readOnly: boolean; onCommit: (value: string | boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (field.type === "checkbox") {
    return <Checkbox checked={draft === true} disabled={readOnly} aria-label={field.name}
      onCheckedChange={(checked) => { setDraft(checked === true); onCommit(checked === true); }} />;
  }
  if (field.type === "select") {
    const options = field.options ?? [];
    const current = String(draft);
    return (
      <select className={fieldClass} value={current} disabled={readOnly} aria-label={field.name}
        onChange={(event) => { setDraft(event.target.value); onCommit(event.target.value); }}>
        <option value="">{t("pmViews.none", { defaultValue: "—" })}</option>
        {current && !options.includes(current) && <option value={current}>{current}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  const multiline = field.type === "text" && String(draft).length > 80;
  if (multiline) {
    return (
      <textarea className={`${fieldClass} h-auto min-h-24 py-2`} value={String(draft)} disabled={readOnly} aria-label={field.name}
        onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(String(draft)); }} />
    );
  }
  const safeUrl = field.type === "url" ? resolveSafeTableUrl(String(draft)) : null;
  return (
    <div className="flex items-center gap-2">
      <Input className="h-9" value={String(draft)} disabled={readOnly} aria-label={field.name}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
        onChange={(event) => { setDraft(event.target.value); if (field.type === "date") onCommit(event.target.value); }}
        onBlur={() => { if (field.type !== "date" && draft !== value) onCommit(String(draft)); }}
        onKeyDown={(event) => { if (event.key === "Enter" && field.type !== "date") onCommit(String(draft)); }} />
      {safeUrl && (
        <a href={safeUrl} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t("pmViews.openLink", { defaultValue: "Open link" })}>
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

/** Full-record editor opened from a board card, calendar chip or timeline bar. */
export function TableRecordDialog({ document, recordId, readOnly, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const record = recordId ? document.records.find((item) => item.id === recordId) : undefined;
  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {record && (
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl p-4 sm:p-6">
          <DialogTitle className="pr-8 text-base">
            {recordTitle(document, record) || t("pmViews.untitled", { defaultValue: "Untitled" })}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("pmViews.recordDetails", { defaultValue: "Record details" })}</DialogDescription>
          <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
            {document.fields.map((field) => {
              const raw = record.cells[field.id] ?? null;
              return (
                <label key={field.id} className="grid gap-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                  <span className="pt-2 text-xs font-medium text-muted-foreground">{field.name}</span>
                  {field.type === "attachment" ? (
                    <span className="py-2 text-sm text-foreground">
                      {displayValue(field, raw) || t("pmViews.attachmentsInTable", { defaultValue: "Edit attachments in the table view" })}
                    </span>
                  ) : (
                    <FieldEditor field={field} readOnly={readOnly}
                      value={field.type === "checkbox" ? raw === true : raw === null || Array.isArray(raw) ? "" : String(raw)}
                      onCommit={(value) => onChange(updateTableCell(document, record.id, field.id, value))} />
                  )}
                </label>
              );
            })}
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button type="button" variant="ghost" disabled={readOnly} className="text-destructive"
              onClick={() => { onChange(removeTableRecord(document, record.id)); onClose(); }}>
              <Trash2 className="size-4" /> {t("structuredTable.deleteRecord")}
            </Button>
            <Button type="button" variant="solid" onClick={onClose}>{t("pmViews.done", { defaultValue: "Done" })}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
