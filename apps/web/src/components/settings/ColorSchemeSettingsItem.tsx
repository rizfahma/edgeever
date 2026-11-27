import { useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  applyColorScheme, CLASSIC_SCHEME_ID, COLOR_SCHEMES, readColorScheme, readSchemeAccent, schemeById,
} from "@/lib/color-schemes";
import { SETTINGS_ITEM_DESCRIPTION_CLASSNAME, SETTINGS_ITEM_ICON_CLASSNAME, SETTINGS_ITEM_TITLE_CLASSNAME } from "./settings-ui";

// Light colour scheme picker (fork customization). Preset palettes come from
// popular editor themes; the accent override recolours charts, focus rings and
// the selection highlight on top of any preset.

const CLASSIC = {
  id: CLASSIC_SCHEME_ID, label: "EdgeEver Classic",
  canvas: "#f5f5f5", surface: "#ffffff", sidebar: "#e7ebef", border: "#e0e0e0", text: "#212121", accent: "#171717", highlight: "#16a06e", success: "#16a06e",
};

export function ColorSchemeSettingsItem() {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState(readColorScheme);
  const [accent, setAccent] = useState(readSchemeAccent);
  const choices = [...COLOR_SCHEMES, CLASSIC];
  const baseAccent = schemeById(scheme)?.accent ?? "#2563eb";

  const choose = (id: string) => {
    setScheme(id);
    applyColorScheme(id, accent, true);
  };
  const changeAccent = (value: string | null) => {
    setAccent(value);
    applyColorScheme(scheme, value, true);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Palette className={SETTINGS_ITEM_ICON_CLASSNAME} />
        <div className="min-w-0">
          <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.colorSchemeTitle", { defaultValue: "Colour scheme" })}</div>
          <div className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>
            {t("settings.colorSchemeDescription", { defaultValue: "Used with the light appearance. Dark mode keeps its own colours." })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup"
        aria-label={t("settings.colorSchemeTitle", { defaultValue: "Colour scheme" })}>
        {choices.map((item) => {
          const selected = item.id === scheme;
          return (
            <button key={item.id} type="button" role="radio" aria-checked={selected} onClick={() => choose(item.id)}
              className="group overflow-hidden rounded-lg border border-border bg-card text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring aria-checked:border-foreground aria-checked:ring-1 aria-checked:ring-foreground">
              <span className="flex h-14 gap-1.5 p-2" style={{ background: item.canvas }} aria-hidden="true">
                <span className="w-4 rounded-sm" style={{ background: item.sidebar, border: `1px solid ${item.border}` }} />
                <span className="flex flex-1 flex-col gap-1 rounded-sm p-1.5" style={{ background: item.surface, border: `1px solid ${item.border}` }}>
                  <span className="h-1.5 w-3/4 rounded-full" style={{ background: item.text }} />
                  <span className="flex gap-1">
                    <span className="h-1.5 flex-1 rounded-full" style={{ background: item.accent }} />
                    <span className="h-1.5 w-3 rounded-full" style={{ background: item.highlight }} />
                    <span className="h-1.5 w-2 rounded-full" style={{ background: item.success }} />
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-foreground">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {selected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
      {scheme !== CLASSIC_SCHEME_ID && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("settings.colorSchemeAccent", { defaultValue: "Accent colour" })}</span>
            <input type="color" value={accent ?? baseAccent} onChange={(event) => changeAccent(event.target.value)}
              className="h-8 w-12 cursor-pointer rounded-md border border-border bg-card p-0.5" />
          </label>
          {accent && (
            <Button type="button" variant="ghost" size="sm" onClick={() => changeAccent(null)}>
              <RotateCcw className="size-3.5" /> {t("settings.colorSchemeAccentReset", { defaultValue: "Use the scheme's accent" })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
