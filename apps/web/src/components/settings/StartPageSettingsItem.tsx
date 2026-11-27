import { useEffect, useState } from "react";
import { House, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { readStartPage, START_PAGE_CHANGED_EVENT, writeStartPage } from "@/lib/start-page";
import { SETTINGS_ITEM_DESCRIPTION_CLASSNAME, SETTINGS_ITEM_ICON_CLASSNAME, SETTINGS_ITEM_TITLE_CLASSNAME } from "./settings-ui";

export function StartPageSettingsItem() {
  const { t } = useTranslation();
  const [page, setPage] = useState(readStartPage);
  useEffect(() => {
    const sync = () => setPage(readStartPage());
    window.addEventListener(START_PAGE_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(START_PAGE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <House className={SETTINGS_ITEM_ICON_CLASSNAME} />
        <div className="min-w-0">
          <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("startPage.title", { defaultValue: "Start page" })}</div>
          <div className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>
            {t("startPage.description", { defaultValue: "The note that opens when you load EdgeEver. Right-click any note in the list and choose “Set as start page”." })}
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
  );
}
