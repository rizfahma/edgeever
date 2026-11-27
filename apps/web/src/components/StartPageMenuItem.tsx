import { House } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { readStartPage, writeStartPage } from "@/lib/start-page";

/** Note context-menu action: make this note the start page, or stop using it as one. */
export function StartPageMenuItem({ memo, onDone }: {
  memo: { id: string; notebookId: string | null; title: string | null };
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const isStartPage = readStartPage()?.memoId === memo.id;
  return (
    <DropdownMenuItem
      className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer outline-none"
      onClick={() => {
        writeStartPage(isStartPage ? null : { memoId: memo.id, notebookId: memo.notebookId, title: memo.title?.trim() ?? "" });
        onDone();
      }}
    >
      <House className="h-4 w-4 text-slate-500" />
      {isStartPage
        ? t("startPage.remove", { defaultValue: "Stop opening this note at start" })
        : t("startPage.set", { defaultValue: "Set as start page" })}
    </DropdownMenuItem>
  );
}
