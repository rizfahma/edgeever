// Light colour schemes (fork customization).
//
// Each scheme is a small palette borrowed from a well-known editor theme. The
// CSS is generated once at start-up from these definitions, so adding a scheme
// means adding one entry here. Schemes only apply to the light appearance:
// dark mode and extension themes keep their own colours.

export type ColorScheme = {
  id: string;
  label: string;
  /** Page background, behind cards. */
  canvas: string;
  /** Cards, popovers, the editor surface. */
  surface: string;
  /** Sidebar and note list. */
  sidebar: string;
  /** Muted fills: hover, chips, table headers. */
  muted: string;
  border: string;
  text: string;
  subtext: string;
  /** Primary buttons (usually the scheme's ink). */
  primary: string;
  primaryText: string;
  /** Charts and focus rings: main, highlight, success. */
  accent: string;
  highlight: string;
  success: string;
};

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: "edgeever", label: "EdgeEver Light",
    canvas: "#f6f7f9", surface: "#ffffff", sidebar: "#f8f9fb", muted: "#f2f3f6", border: "#e6e8ec",
    text: "#14171c", subtext: "#5b616e", primary: "#14171c", primaryText: "#ffffff",
    accent: "#2563eb", highlight: "#ea7a12", success: "#16a34a",
  },
  {
    id: "solarized-light", label: "Solarized Light",
    canvas: "#eee8d5", surface: "#fdf6e3", sidebar: "#f5efdc", muted: "#eee8d5", border: "#e0d9c2",
    text: "#073642", subtext: "#586e75", primary: "#073642", primaryText: "#fdf6e3",
    accent: "#268bd2", highlight: "#cb4b16", success: "#859900",
  },
  {
    id: "github-light", label: "GitHub Light",
    canvas: "#f6f8fa", surface: "#ffffff", sidebar: "#f6f8fa", muted: "#eff2f5", border: "#d0d7de",
    text: "#1f2328", subtext: "#59636e", primary: "#1f883d", primaryText: "#ffffff",
    accent: "#0969da", highlight: "#bc4c00", success: "#1a7f37",
  },
  {
    id: "catppuccin-latte", label: "Catppuccin Latte",
    canvas: "#e6e9ef", surface: "#eff1f5", sidebar: "#e6e9ef", muted: "#dce0e8", border: "#ccd0da",
    text: "#4c4f69", subtext: "#6c6f85", primary: "#8839ef", primaryText: "#eff1f5",
    accent: "#1e66f5", highlight: "#fe640b", success: "#40a02b",
  },
  {
    id: "rose-pine-dawn", label: "Rosé Pine Dawn",
    canvas: "#f2e9e1", surface: "#fffaf3", sidebar: "#faf4ed", muted: "#f2e9e1", border: "#dfdad9",
    text: "#575279", subtext: "#797593", primary: "#286983", primaryText: "#fffaf3",
    accent: "#286983", highlight: "#d7827e", success: "#56949f",
  },
  {
    id: "nord-light", label: "Nord Light",
    canvas: "#e5e9f0", surface: "#f8f9fb", sidebar: "#eceff4", muted: "#e5e9f0", border: "#d8dee9",
    text: "#2e3440", subtext: "#4c566a", primary: "#5e81ac", primaryText: "#ffffff",
    accent: "#5e81ac", highlight: "#d08770", success: "#8fac76",
  },
  {
    id: "gruvbox-light", label: "Gruvbox Light",
    canvas: "#ebdbb2", surface: "#fbf1c7", sidebar: "#f2e5bc", muted: "#ebdbb2", border: "#d5c4a1",
    text: "#3c3836", subtext: "#7c6f64", primary: "#3c3836", primaryText: "#fbf1c7",
    accent: "#076678", highlight: "#af3a03", success: "#79740e",
  },
  {
    id: "ayu-light", label: "Ayu Light",
    canvas: "#f3f4f5", surface: "#fcfcfc", sidebar: "#f8f9fa", muted: "#eef0f1", border: "#e7e8e9",
    text: "#5c6166", subtext: "#8a9199", primary: "#fa8d3e", primaryText: "#ffffff",
    accent: "#399ee6", highlight: "#fa8d3e", success: "#86b300",
  },
  {
    id: "one-light", label: "One Light",
    canvas: "#eaeaeb", surface: "#fafafa", sidebar: "#f0f0f1", muted: "#e5e5e6", border: "#dbdbdc",
    text: "#383a42", subtext: "#696c77", primary: "#4078f2", primaryText: "#ffffff",
    accent: "#4078f2", highlight: "#c18401", success: "#50a14f",
  },
];

/** "classic" keeps EdgeEver's original light colours and system font. */
export const CLASSIC_SCHEME_ID = "classic";
export const DEFAULT_SCHEME_ID = "edgeever";
const SCHEME_KEY = "edgeever.colorScheme";
const ACCENT_KEY = "edgeever.colorSchemeAccent";
const STYLE_ID = "edgeever-color-schemes";

const HEX = /^#[0-9a-f]{6}$/i;

const read = (key: string) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing; the choice then lasts for this page only.
  }
};

/** "#rrggbb" → "H S% L%", the triplet format the shadcn variables use. */
export const hexToHslTriplet = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
};

const mix = (a: string, b: string, weight: number) => `color-mix(in srgb, ${a} ${weight}%, ${b})`;

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

// Much of the interface uses the slate scale directly (text-slate-700 and so
// on). Rebuilding that scale between the scheme's surface and ink keeps those
// greys in the same family as the scheme instead of Tailwind's blue-grey.
const SLATE_STOPS = [[50, 0.03], [100, 0.06], [200, 0.12], [300, 0.22], [400, 0.38], [500, 0.52], [600, 0.64], [700, 0.76], [800, 0.86], [900, 0.94], [950, 1]] as const;
const slateRamp = (scheme: ColorScheme) => {
  const from = rgb(scheme.surface);
  const to = rgb(scheme.text);
  return SLATE_STOPS.map(([step, t]) => `  --slate-${step}-rgb: ${from.map((channel, index) => Math.round(channel + (to[index]! - channel) * t)).join(" ")};`).join("\n");
};

const schemeCss = (scheme: ColorScheme) => {
  const hsl = hexToHslTriplet;
  return `:root[data-color-scheme="${scheme.id}"]:not(.dark):not([data-edgeever-extension-theme]) {
  --background: ${hsl(scheme.canvas)};
  --foreground: ${hsl(scheme.text)};
  --card: ${hsl(scheme.surface)};
  --card-foreground: ${hsl(scheme.text)};
  --popover: ${hsl(scheme.surface)};
  --popover-foreground: ${hsl(scheme.text)};
  --primary: ${hsl(scheme.primary)};
  --primary-foreground: ${hsl(scheme.primaryText)};
  --secondary: ${hsl(scheme.muted)};
  --secondary-foreground: ${hsl(scheme.text)};
  --muted: ${hsl(scheme.muted)};
  --muted-foreground: ${hsl(scheme.subtext)};
  --accent: ${hsl(scheme.muted)};
  --accent-foreground: ${hsl(scheme.text)};
  --border: ${hsl(scheme.border)};
  --input: ${hsl(scheme.border)};
  --ring: var(--edgeever-accent-hsl, ${hsl(scheme.accent)});
  --workspace-canvas: ${scheme.canvas};
  --workspace-sidebar: ${scheme.sidebar};
  --workspace-memo-list: ${mix(scheme.sidebar, scheme.surface, 50)};
  --workspace-editor: ${scheme.surface};
  --workspace-divider: ${scheme.border};
  --workspace-memo-divider: ${mix(scheme.border, scheme.surface, 70)};
  --workspace-selection: ${mix(`var(--edgeever-accent, ${scheme.accent})`, scheme.surface, 14)};
  --workspace-hover: ${mix(scheme.text, scheme.sidebar, 5)};
  --tooltip-bg: ${scheme.surface};
  --tooltip-fg: ${scheme.subtext};
  --tooltip-border: ${scheme.border};
  --edgeever-chart-1: var(--edgeever-accent, ${scheme.accent});
  --edgeever-chart-2: ${scheme.highlight};
  --edgeever-chart-3: ${scheme.success};
${scheme.id === DEFAULT_SCHEME_ID ? "" : slateRamp(scheme)}
}
:root[data-color-scheme="${scheme.id}"]:not(.dark):not([data-edgeever-extension-theme]) ::selection {
  background: ${mix(`var(--edgeever-accent, ${scheme.accent})`, "transparent", 24)};
}`;
};

export const readColorScheme = () => {
  const stored = read(SCHEME_KEY);
  return stored === CLASSIC_SCHEME_ID || COLOR_SCHEMES.some((scheme) => scheme.id === stored) ? stored! : DEFAULT_SCHEME_ID;
};

export const readSchemeAccent = () => {
  const stored = read(ACCENT_KEY);
  return stored && HEX.test(stored) ? stored : null;
};

export const schemeById = (id: string) => COLOR_SCHEMES.find((scheme) => scheme.id === id);

/** Apply a scheme and optional accent override to the page, and remember them. */
export const applyColorScheme = (id = readColorScheme(), accent = readSchemeAccent(), persist = false) => {
  if (typeof document === "undefined") return;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = COLOR_SCHEMES.map(schemeCss).join("\n");
    document.head.appendChild(style);
  }
  const root = document.documentElement;
  root.dataset.colorScheme = id;
  if (accent && HEX.test(accent) && id !== CLASSIC_SCHEME_ID) {
    root.style.setProperty("--edgeever-accent", accent);
    root.style.setProperty("--edgeever-accent-hsl", hexToHslTriplet(accent));
  } else {
    root.style.removeProperty("--edgeever-accent");
    root.style.removeProperty("--edgeever-accent-hsl");
  }
  if (persist) {
    write(SCHEME_KEY, id);
    write(ACCENT_KEY, accent && HEX.test(accent) ? accent : null);
  }
};
