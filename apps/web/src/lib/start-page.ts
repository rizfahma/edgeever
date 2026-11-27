// Start page (fork customization): the note EdgeEver opens on a fresh load of
// the workspace, instead of the first note of the demo notebook. Stored per
// browser, like the other appearance preferences.

export const START_PAGE_STORAGE_KEY = "edgeever.startPage";
export const START_PAGE_CHANGED_EVENT = "edgeever:start-page-changed";

export type StartPage = { memoId: string; notebookId: string | null; title: string };

export const readStartPage = (): StartPage | null => {
  try {
    const raw = window.localStorage.getItem(START_PAGE_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StartPage>;
    if (typeof value.memoId !== "string" || !value.memoId) return null;
    return {
      memoId: value.memoId,
      notebookId: typeof value.notebookId === "string" && value.notebookId ? value.notebookId : null,
      title: typeof value.title === "string" ? value.title : "",
    };
  } catch {
    return null;
  }
};

export const writeStartPage = (page: StartPage | null) => {
  try {
    if (page) window.localStorage.setItem(START_PAGE_STORAGE_KEY, JSON.stringify(page));
    else window.localStorage.removeItem(START_PAGE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; nothing else depends on it.
  }
  window.dispatchEvent(new CustomEvent(START_PAGE_CHANGED_EVENT));
};

/**
 * The selection to start with on a plain workspace load ("/" with no query),
 * or null when another route, a restore, or no start page applies.
 */
export const initialStartPageSelection = (pathname: string, search: string, hash = "") => {
  // Note links (#memo=…) and any other route win over the start page.
  if (pathname !== "/" || search || /memo=/.test(hash)) return null;
  const page = readStartPage();
  return page ? { selectedMemoId: page.memoId, selectedNotebookId: page.notebookId } : null;
};
