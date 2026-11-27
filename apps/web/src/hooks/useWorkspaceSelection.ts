import { useCallback, useRef, useState } from "react";
import { initialStartPageSelection } from "@/lib/start-page";

export const useWorkspaceSelection = (initial?: {
  selectedMemoId?: string | null;
  selectedNotebookId?: string | null;
} | null) => {
  // Fork: without a desktop restore, a plain load opens the chosen start page.
  const [start] = useState(() => initial ?? (typeof window === "undefined" ? null : initialStartPageSelection(window.location.pathname, window.location.search)));
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(start?.selectedNotebookId ?? null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(start?.selectedMemoId ?? null);
  const selectedMemoIdRef = useRef(selectedMemoId);
  selectedMemoIdRef.current = selectedMemoId;
  const [selectedMemoIds, setSelectedMemoIds] = useState<Set<string>>(() => new Set());
  const [memoSelectionMode, setMemoSelectionMode] = useState(false);
  const [selectionMoveTargetNotebookId, setSelectionMoveTargetNotebookId] = useState("");

  const clearMemoSelection = useCallback(() => {
    setSelectedMemoIds(new Set());
    setMemoSelectionMode(false);
  }, []);

  const replaceMemoSelection = useCallback((memoIds: string[]) => {
    setSelectedMemoIds(new Set(memoIds));
    setMemoSelectionMode(true);
  }, []);

  const beginMemoSelection = useCallback(() => setMemoSelectionMode(true), []);

  return {
    initialSelectedMemoId: start?.selectedMemoId ?? null,
    beginMemoSelection,
    clearMemoSelection,
    memoSelectionMode,
    replaceMemoSelection,
    selectedMemoId,
    selectedMemoIdRef,
    selectedMemoIds,
    selectedNotebookId,
    selectionMoveTargetNotebookId,
    setMemoSelectionMode,
    setSelectedMemoId,
    setSelectedMemoIds,
    setSelectedNotebookId,
    setSelectionMoveTargetNotebookId,
  };
};
