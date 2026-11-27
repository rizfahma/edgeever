import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, Filter, GanttChart, LayoutDashboard, MoreHorizontal, Plus, SquareKanban, Table2, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createTableId, isValidTypedTableFilter, tableFilterNeedsValue, TABLE_VIEW_FILTER_LIMIT, TABLE_VIEW_OPERATORS,
  type NamedTableView, type TableField, type TableViewFilter, type TableViewLayout, type TableViewOperator, type TableViewSort,
} from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Mode = "filter" | "sort" | "new" | "copy" | "rename" | "delete" | "layout";

const LAYOUT_ICONS: Record<TableViewLayout, LucideIcon> = { table: Table2, board: SquareKanban, calendar: CalendarDays, timeline: GanttChart, dashboard: LayoutDashboard };
const LAYOUT_LABELS: Record<TableViewLayout, string> = { table: "Table", board: "Board", calendar: "Calendar", timeline: "Timeline", dashboard: "Dashboard" };
type LayoutDraft = { layout: TableViewLayout; groupFieldId?: string; dateFieldId?: string; endDateFieldId?: string; breakdownFieldId?: string };
const layoutOf = (view: NamedTableView): LayoutDraft => ({
  layout: view.layout ?? "table", groupFieldId: view.groupFieldId, dateFieldId: view.dateFieldId, endDateFieldId: view.endDateFieldId,
  breakdownFieldId: view.breakdownFieldId,
});
/** Merge layout settings into a view; "table" removes them entirely. */
const withLayout = (view: NamedTableView, draft: LayoutDraft): NamedTableView => {
  const { layout: _layout, groupFieldId: _group, dateFieldId: _date, endDateFieldId: _end, breakdownFieldId: _breakdown, ...rest } = view;
  if (draft.layout === "table") return rest;
  return {
    ...rest, layout: draft.layout,
    ...((draft.layout === "board" || draft.layout === "dashboard") && draft.groupFieldId ? { groupFieldId: draft.groupFieldId } : {}),
    ...(draft.layout === "dashboard" && draft.breakdownFieldId && draft.breakdownFieldId !== draft.groupFieldId ? { breakdownFieldId: draft.breakdownFieldId } : {}),
    ...(draft.layout !== "board" && draft.dateFieldId ? { dateFieldId: draft.dateFieldId } : {}),
    ...(draft.layout === "timeline" && draft.endDateFieldId && draft.endDateFieldId !== draft.dateFieldId ? { endDateFieldId: draft.endDateFieldId } : {}),
  };
};
type FilterDraft = { id: number; rule: TableViewFilter };
type Props = {
  fields: TableField[];
  views: NamedTableView[];
  active: NamedTableView;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onCommit: (views: NamedTableView[], selected: string) => Promise<boolean>;
};

const selectClass = "h-9 min-w-0 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const newRule = (field: TableField, operator: TableViewOperator = TABLE_VIEW_OPERATORS[field.type][0]): TableViewFilter =>
  field.type === "checkbox" ? { fieldId: field.id, operator, value: false } : { fieldId: field.id, operator };

function IconAction({ label, children, onClick, disabled }: {
  label: string; children: ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function FilterValue({ field, rule, onChange }: {
  field: TableField; rule: TableViewFilter; onChange: (rule: TableViewFilter) => void;
}) {
  const { t } = useTranslation();
  if (!tableFilterNeedsValue(rule.operator)) return null;
  const label = t("structuredTable.filterValue");
  const value = String(rule.value ?? "");
  const change = (next: string) => {
    if (rule.legacy) onChange({ ...rule, value: next });
    else onChange({ ...rule, value: field.type === "number" ? next === "" ? undefined : Number(next) : field.type === "checkbox" ? next === "true" : next });
  };
  if (field.type === "checkbox" && rule.operator === "eq") {
    return (
      <select className={selectClass} value={String(value === "true")} onChange={(event) => change(event.target.value)} aria-label={label}>
        <option value="false">{t("structuredTable.views.unchecked")}</option>
        <option value="true">{t("structuredTable.views.checked")}</option>
      </select>
    );
  }
  if (field.type === "select" && (rule.operator === "eq" || rule.operator === "neq")) {
    const options = field.options ?? [];
    return (
      <select className={selectClass} value={value} onChange={(event) => change(event.target.value)} aria-label={label}>
        <option value="">{t("structuredTable.views.chooseOption")}</option>
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }
  const type = field.type === "number" && (!rule.legacy || (rule.operator === "eq" && Number.isFinite(Number(value)))) ? "number"
    : field.type === "date" && (!rule.legacy || (rule.operator === "eq" && /^\d{4}-\d{2}-\d{2}$/.test(value))) ? "date" : "text";
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Input className="h-9 min-w-0 flex-1" aria-label={label} type={type} step={type === "number" ? "any" : undefined}
        value={value} onChange={(event) => change(event.target.value)} />
      {rule.operator === "between" && (
        <Input className="h-9 min-w-0 flex-1" aria-label={t("structuredTable.views.endDate")} type="date"
          value={rule.endValue ?? ""} onChange={(event) => onChange({ ...rule, endValue: event.target.value })} />
      )}
    </div>
  );
}

function ViewDialog({ mode, fields, views, active, readOnly, onCommit, close, focusOpener }: Props & {
  mode: Mode; close: () => void; focusOpener: () => void;
}) {
  const { t } = useTranslation();
  const label = (view: NamedTableView) => view.name || t("structuredTable.views.default");
  const [name, setName] = useState(() => mode === "copy" ? t("structuredTable.views.copyName", { name: label(active) }) : mode === "rename" ? label(active) : "");
  const [match, setMatch] = useState(active.match);
  const nextId = useRef(active.filters.length);
  const [filters, setFilters] = useState<FilterDraft[]>(() => active.filters.map((rule, id) => ({ id, rule })));
  const [sorts, setSorts] = useState(active.sorts);
  const [layout, setLayout] = useState<LayoutDraft>(() => mode === "new" ? { layout: "table" } : layoutOf(active));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const descriptionId = useId();
  const byId = new Map(fields.map((field) => [field.id, field]));
  const named = mode === "new" || mode === "copy" || mode === "rename";
  const selectFields = fields.filter((field) => field.type === "select");
  const dateFields = fields.filter((field) => field.type === "date");
  const layoutReady = layout.layout === "table" || layout.layout === "dashboard" || (layout.layout === "board" ? selectFields.length > 0 : dateFields.length > 0);
  const valid = mode === "layout" ? layoutReady : named ? Boolean(name.trim()) && (mode !== "new" || layoutReady) : mode === "filter"
    ? filters.every(({ rule }) => {
      const field = byId.get(rule.fieldId);
      return field && (rule.legacy || isValidTypedTableFilter(field, rule));
    })
    : mode === "sort" ? sorts.every((rule) => byId.has(rule.fieldId)) : views.length > 1;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy || readOnly) return;
    let selected = active.id;
    let next: NamedTableView[];
    if (mode === "new" || mode === "copy") {
      selected = createTableId("view");
      next = [...views, mode === "copy" ? { ...active, id: selected, name }
        : withLayout({ id: selected, name, match: "all", filters: [], sorts: [] }, layout)];
    } else if (mode === "delete") {
      next = views.filter((view) => view.id !== active.id);
      selected = next[Math.max(0, views.findIndex((view) => view.id === active.id) - 1)]!.id;
    } else {
      next = views.map((view) => view.id !== active.id ? view : mode === "layout" ? withLayout(view, layout) : {
        ...view, ...(mode === "filter" ? { match, filters: filters.map(({ rule }) => rule) }
          : mode === "sort" ? { sorts } : { name }),
      });
    }
    setBusy(true);
    setError("");
    try {
      if (await onCommit(next, selected)) close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("structuredTable.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const changeFilter = (id: number, rule: TableViewFilter) => setFilters((items) => items.map((item) => item.id === id ? { id, rule } : item));
  const setSort = (index: number, rule: TableViewSort) => setSorts((items) => items.map((item, position) => position === index ? rule : item));
  const moveSort = (index: number, delta: number) => setSorts((items) => {
    const next = [...items];
    const target = index + delta;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  });
  const unusedSortField = fields.find((field) => !sorts.some((sort) => sort.fieldId === field.id));
  const title = mode === "layout" ? t("pmViews.layout", { defaultValue: "Layout" })
    : mode === "filter" || mode === "sort" ? t(`structuredTable.${mode}`) : t(`structuredTable.views.${mode}`);
  const fieldSelect = (label: string, value: string | undefined, options: TableField[], onChange: (id: string | undefined) => void, optional: boolean | string = false) => (
    <label className="grid gap-1.5 text-sm">
      {label}
      <select className={selectClass} value={value ?? (optional ? "" : options[0]?.id ?? "")} onChange={(event) => onChange(event.target.value || undefined)}>
        {optional && <option value="">{typeof optional === "string" ? optional : t("pmViews.noEndDate", { defaultValue: "None (one-day bars)" })}</option>}
        {options.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select>
    </label>
  );
  return (
    <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl p-4 sm:p-6" showCloseButton={false}
      aria-describedby={mode === "delete" ? descriptionId : undefined}
      onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
      onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); focusOpener(); }}>
      <form className="grid gap-4" onSubmit={(event) => { void submit(event); }}>
        <DialogTitle>{title}</DialogTitle>
        {named && (
          <label className="grid gap-2 text-sm">
            {t("structuredTable.views.name")}
            <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        {(mode === "new" || mode === "layout") && (
          <fieldset className="grid gap-3" disabled={readOnly}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t("pmViews.layout", { defaultValue: "Layout" })}>
              {(Object.keys(LAYOUT_ICONS) as TableViewLayout[]).map((item) => {
                const Icon = LAYOUT_ICONS[item];
                return (
                  <button key={item} type="button" role="radio" aria-checked={layout.layout === item}
                    onClick={() => setLayout((current) => {
                      const status = selectFields.find((field) => /status|state|stage/i.test(field.name)) ?? selectFields[0];
                      const groupFieldId = current.groupFieldId ?? (item === "dashboard" ? status?.id : selectFields[0]?.id);
                      return {
                        ...current, layout: item, groupFieldId,
                        dateFieldId: current.dateFieldId ?? dateFields[0]?.id,
                        breakdownFieldId: current.breakdownFieldId ?? (item === "dashboard" ? selectFields.find((field) => field.id !== groupFieldId)?.id : undefined),
                      };
                    })}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-border px-2 py-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-checked:border-foreground aria-checked:bg-muted/50 aria-checked:font-medium aria-checked:text-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                    {t(`pmViews.layout_${item}`, { defaultValue: LAYOUT_LABELS[item] })}
                  </button>
                );
              })}
            </div>
            {layout.layout === "board" && (selectFields.length
              ? fieldSelect(t("pmViews.groupBy", { defaultValue: "Columns from" }), layout.groupFieldId, selectFields, (id) => setLayout((current) => ({ ...current, groupFieldId: id })))
              : <p className="text-sm text-muted-foreground">{t("pmViews.boardNeedsSelect", { defaultValue: "A board groups cards by a pick-list column. Add a select column (for example Status) to use this view." })}</p>)}
            {layout.layout === "dashboard" && (
              <div className="grid gap-3 sm:grid-cols-3">
                {selectFields.length > 0 && fieldSelect(t("pmViews.dashStatusField", { defaultValue: "Status" }), layout.groupFieldId, selectFields,
                  (id) => setLayout((current) => ({ ...current, groupFieldId: id })))}
                {dateFields.length > 0 && fieldSelect(t("pmViews.dateField", { defaultValue: "Date" }), layout.dateFieldId, dateFields,
                  (id) => setLayout((current) => ({ ...current, dateFieldId: id })))}
                {selectFields.length > 1 && fieldSelect(t("pmViews.dashBreakdownField", { defaultValue: "Break down by" }), layout.breakdownFieldId,
                  selectFields.filter((field) => field.id !== layout.groupFieldId),
                  (id) => setLayout((current) => ({ ...current, breakdownFieldId: id })), t("pmViews.none", { defaultValue: "None" }))}
              </div>
            )}
            {(layout.layout === "calendar" || layout.layout === "timeline") && (dateFields.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldSelect(t(layout.layout === "calendar" ? "pmViews.dateField" : "pmViews.startField", { defaultValue: layout.layout === "calendar" ? "Date" : "Start date" }),
                  layout.dateFieldId, dateFields, (id) => setLayout((current) => ({ ...current, dateFieldId: id })))}
                {layout.layout === "timeline" && fieldSelect(t("pmViews.endField", { defaultValue: "End date" }), layout.endDateFieldId,
                  dateFields.filter((field) => field.id !== (layout.dateFieldId ?? dateFields[0]?.id)), (id) => setLayout((current) => ({ ...current, endDateFieldId: id })), true)}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("pmViews.calendarNeedsDate", { defaultValue: "This layout needs a date column. Add one first." })}</p>)}
          </fieldset>
        )}
        {mode === "delete" && <DialogDescription id={descriptionId}>{t("structuredTable.views.deleteConfirm", { name: label(active) })}</DialogDescription>}
        {mode === "filter" && (
          <fieldset className="grid min-w-0 gap-2" disabled={readOnly}>
            {filters.length > 0 && (
              <select className={`${selectClass} w-fit`} aria-label={t("structuredTable.views.match")}
                value={match} onChange={(event) => setMatch(event.target.value === "any" ? "any" : "all")}>
                <option value="all">{t("structuredTable.views.all")}</option>
                <option value="any">{t("structuredTable.views.any")}</option>
              </select>
            )}
            <div className="grid max-h-[45vh] min-w-0 gap-2 overflow-y-auto pr-1">
              {filters.map(({ id, rule }) => {
                const field = byId.get(rule.fieldId);
                if (!field) return null;
                const available: readonly TableViewOperator[] = TABLE_VIEW_OPERATORS[field.type];
                const operators = available.includes(rule.operator) ? available : [...available, rule.operator];
                return (
                  <div key={id} className="grid min-w-0 grid-cols-[1fr_1fr_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.7fr)_auto]">
                    <select className={selectClass} aria-label={t("structuredTable.fieldName")} value={field.id}
                      onChange={(event) => changeFilter(id, newRule(byId.get(event.target.value)!))}>
                      {fields.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                    <select className={selectClass} aria-label={t("structuredTable.views.operator")} value={rule.operator}
                      onChange={(event) => changeFilter(id, newRule(field, event.target.value as TableViewOperator))}>
                      {operators.map((operator) => {
                        const label = field.type === "date" && operator === "lt" ? "before" : field.type === "date" && operator === "gt" ? "after" : operator;
                        return <option key={operator} value={operator}>{t(`structuredTable.operators.${label}`)}</option>;
                      })}
                    </select>
                    <div className="col-span-3 col-start-1 row-start-2 empty:hidden sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:empty:block">
                      <FilterValue field={field} rule={rule} onChange={(next) => changeFilter(id, next)} />
                    </div>
                    <div className="col-start-3 row-start-1 sm:col-start-4">
                      <IconAction label={t("structuredTable.views.removeRule")} onClick={() => setFilters((items) => items.filter((item) => item.id !== id))}><X className="size-4" /></IconAction>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={filters.length >= TABLE_VIEW_FILTER_LIMIT || !fields.length}
              onClick={() => { const id = nextId.current++; setFilters((items) => [...items, { id, rule: newRule(fields[0]!) }]); }}>
              <Plus className="size-4" /> {t("structuredTable.addFilter")}
            </Button>
          </fieldset>
        )}
        {mode === "sort" && (
          <fieldset className="grid min-w-0 gap-2" disabled={readOnly}>
            <div className="grid max-h-[45vh] gap-2 overflow-y-auto pr-1">
              {sorts.map((rule, index) => {
                const optionOrder = byId.get(rule.fieldId)?.type === "select" && !rule.legacy;
                return (
                  <div key={rule.fieldId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <select className={selectClass} aria-label={t("structuredTable.fieldName")} value={rule.fieldId}
                      onChange={(event) => setSort(index, { fieldId: event.target.value, direction: rule.direction })}>
                      {fields.filter((field) => field.id === rule.fieldId || !sorts.some((sort) => sort.fieldId === field.id))
                        .map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                    </select>
                    <select className={selectClass} aria-label={t("structuredTable.views.direction")} value={rule.direction}
                      onChange={(event) => setSort(index, { ...rule, direction: event.target.value === "desc" ? "desc" : "asc" })}>
                      <option value="asc">{t(optionOrder ? "structuredTable.views.optionOrder" : "structuredTable.ascending")}</option>
                      <option value="desc">{t(optionOrder ? "structuredTable.views.reverseOptionOrder" : "structuredTable.descending")}</option>
                    </select>
                    <div className="flex">
                      <IconAction label={t("structuredTable.views.moveUp")} disabled={index === 0} onClick={() => moveSort(index, -1)}><ArrowUp className="size-4" /></IconAction>
                      <IconAction label={t("structuredTable.views.moveDown")} disabled={index === sorts.length - 1} onClick={() => moveSort(index, 1)}><ArrowDown className="size-4" /></IconAction>
                      <IconAction label={t("structuredTable.views.removeRule")} onClick={() => setSorts((items) => items.filter((item) => item.fieldId !== rule.fieldId))}><X className="size-4" /></IconAction>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={!unusedSortField}
              onClick={() => { if (unusedSortField) setSorts((items) => [...items, { fieldId: unusedSortField.id, direction: "asc" }]); }}>
              <Plus className="size-4" /> {t("structuredTable.views.addSort")}
            </Button>
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>{t("structuredTable.views.cancel")}</Button>
          {!readOnly && <Button type="submit" variant={mode === "delete" ? "danger" : "solid"} disabled={!valid || busy}>
            {t(mode === "delete" ? "structuredTable.views.delete" : "structuredTable.views.apply")}
          </Button>}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function TableViewControls(props: Props) {
  const { t } = useTranslation();
  const { views, active, readOnly, onSelect } = props;
  const [mode, setMode] = useState<Mode | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = (next: Mode, button: HTMLButtonElement | null) => {
    opener.current = button;
    setMode(next);
  };
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null); }}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto" role="group" aria-label={t("structuredTable.views.label")}>
            {views.map((view) => (
              <button type="button" key={view.id} aria-pressed={view.id === active.id} onClick={() => onSelect(view.id)}
                className="flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:border-foreground aria-pressed:font-medium aria-pressed:text-foreground">
                {(() => { const Icon = LAYOUT_ICONS[view.layout ?? "table"]; return <Icon aria-hidden="true" className="size-3.5" />; })()}
                <span className="max-w-44 truncate">{view.name || t("structuredTable.views.default")}</span>
              </button>
            ))}
          </div>
          {!readOnly && (
            <>
              <Button type="button" variant="ghost" size="icon" aria-label={t("structuredTable.views.new")}
                onClick={(event) => open("new", event.currentTarget)}>
                <Plus className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button ref={menuButton} type="button" variant="ghost" size="icon" aria-label={t("structuredTable.views.actions")}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => open("layout", menuButton.current)}>{t("pmViews.changeLayout", { defaultValue: "Change layout…" })}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => open("rename", menuButton.current)}>{t("structuredTable.views.rename")}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => open("copy", menuButton.current)}>{t("structuredTable.views.copy")}</DropdownMenuItem>
                  <DropdownMenuItem disabled={views.length <= 1} onSelect={() => open("delete", menuButton.current)}>{t("structuredTable.views.delete")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 py-1">
          {!readOnly && (() => {
            const current = active.layout ?? "table";
            const Icon = LAYOUT_ICONS[current];
            return (
              <Button type="button" size="sm" variant={current === "table" ? "ghost" : "soft"} onClick={(event) => open("layout", event.currentTarget)}>
                <Icon className="size-3.5" /> {t(`pmViews.layout_${current}`, { defaultValue: LAYOUT_LABELS[current] })}
              </Button>
            );
          })()}
          {(["filter", "sort"] as const).map((item) => {
            const count = item === "filter" ? active.filters.length : active.sorts.length;
            const Icon = item === "filter" ? Filter : ArrowDownUp;
            return (
              <Button key={item} type="button" size="sm" variant={count ? "soft" : "ghost"}
                onClick={(event) => open(item, event.currentTarget)}>
                <Icon className="size-3.5" /> {t(`structuredTable.${item}`)}
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </Button>
            );
          })}
        </div>
      </div>
      {mode && <ViewDialog key={`${active.id}:${mode}`} {...props} mode={mode} close={() => setMode(null)} focusOpener={() => opener.current?.focus()} />}
    </Dialog>
  );
}
