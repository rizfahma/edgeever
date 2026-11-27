import { useEffect, useRef, useState } from "react";
import { FileText, House, Search, Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { readStartPage, START_PAGE_CHANGED_EVENT, writeStartPage } from "@/lib/start-page";
import { SETTINGS_ITEM_DESCRIPTION_CLASSNAME, SETTINGS_ITEM_ICON_CLASSNAME, SETTINGS_ITEM_TITLE_CLASSNAME } from "./settings-ui";

type Result = { id: string; notebookId: string | null; title: string; isTable: boolean };

/** Settings row: pick the note EdgeEver opens after you sign in or reload. */
export function StartPageSettingsItem() {
  const { t } = useTranslation();
  const [page, setPage] = useState(readStartPage);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const sync = () => setPage(readStartPage());
    window.addEventListener(START_PAGE_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(START_PAGE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void api.listMemos({ q, limit: 8, includeTotal: false })
        .then((response) => {
          if (id !== requestId.current) return;
          setResults(response.memos.map((memo) => ({
            id: memo.id,
            notebookId: memo.notebookId ?? null,
            title: memo.title?.trim() || t("pmViews.untitled", { defaultValue: "Untitled" }),
            isTable: Boolean((memo as { structuredTable?: unknown }).structuredTable),
          })));
        })
        .catch(() => { if (id === requestId.current) setResults([]); })
        .finally(() => { if (id === requestId.current) setSearching(false); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, t]);

  const choose = (result: Result) => {
    writeStartPage({ memoId: result.id, notebookId: result.notebookId, title: result.title });
    setQuery("");
    setResults([]);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <House className={SETTINGS_ITEM_ICON_CLASSNAME} />
          <div className="min-w-0">
            <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("startPage.title", { defaultValue: "Start page" })}</div>
            <div className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>
              {t("startPage.description", { defaultValue: "Opens after you sign in or reload. Search below, or right-click a note and choose “Set as start page”." })}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-80">
          <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
            {page ? page.title || t("pmViews.untitled", { defaultValue: "Untitled" }) : t("startPage.none", { defaultValue: "Not set (first note of the list)" })}
          </span>
          {page && (
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0"
              aria-label={t("startPage.clear", { defaultValue: "Clear start page" })}
              onClick={() => writeStartPage(null)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-1.5 sm:ml-auto sm:w-80">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 bg-card pl-8"
            placeholder={t("startPage.search", { defaultValue: "Find a note to open first" })}
            aria-label={t("startPage.search", { defaultValue: "Find a note to open first" })} />
        </div>
        {query.trim().length >= 2 && (
          <ul className="overflow-hidden rounded-md border border-border bg-card" role="listbox"
            aria-label={t("startPage.results", { defaultValue: "Matching notes" })} aria-busy={searching}>
            {results.map((result) => (
              <li key={result.id} role="option" aria-selected={page?.memoId === result.id}>
                <button type="button" onClick={() => choose(result)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60">
                  {result.isTable ? <Table2 className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{result.title}</span>
                </button>
              </li>
            ))}
            {!results.length && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {searching ? t("startPage.searching", { defaultValue: "Searching…" }) : t("startPage.noResults", { defaultValue: "No matching notes" })}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
