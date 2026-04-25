import { useCallback, useEffect } from "react";
import { useEditorStore } from "~/stores/editorStore";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { TurnList } from "./TurnList";
import { EditorInputBar } from "./EditorInputBar";
import { DropZone } from "./DropZone";
import { DiffViewer } from "./DiffViewer";
import { getSessionByGalleryItemId, getSessionById, saveReferenceImage } from "~/lib/db";
import { hydrateStoredSession } from "~/lib/editorSession";

export function EditorView() {
  const hasSource = useEditorStore((s) => s.sourceBlob !== null);
  const sourcePrompt = useEditorStore((s) => s.sourcePrompt);
  const setSource = useEditorStore((s) => s.setSource);
  const hydrateSession = useEditorStore((s) => s.hydrateSession);

  const editorTitle = hasSource && sourcePrompt ? `Editor · ${sourcePrompt}` : "Editor";

  const handleSourceFile = useCallback(
    async (file: File) => {
      const refId = crypto.randomUUID();
      await saveReferenceImage({ id: refId, blob: file, name: file.name });
      setSource({
        blob: file,
        prompt: file.name.replace(/\.[^.]+$/, ""),
        referenceId: refId,
      });
    },
    [setSource]
  );

  // Session restore: runs once on mount
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const state = useEditorStore.getState();

      // Determine which session to look for
      let session = null;
      if (state.sourceGalleryItemId) {
        // Navigated here from lightbox — check for a saved session for this source image
        session = await getSessionByGalleryItemId(state.sourceGalleryItemId);
        if (!session) return;
        // Same session already loaded — nothing to restore
        if (session.id === state.currentSessionId) return;
      } else if (!state.sourceBlob) {
        // Tab reload — no in-memory source; try to find the last active session
        const lastId = localStorage.getItem("editorSessionId");
        if (!lastId) return;
        session = await getSessionById(lastId);
        if (!session) return;
      } else {
        // Store already has a source from a fresh file drop — nothing to restore
        return;
      }

      if (cancelled) return;

      const hydrated = await hydrateStoredSession(session);
      if (!hydrated) return;

      if (cancelled) {
        hydrated.createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      hydrateSession(hydrated);
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-surface">
      <GalleryHeader title={editorTitle} />

      <div className="relative max-h-full flex-1 overflow-hidden">
        {hasSource ? <TurnList /> : <DropZone onFile={(file) => void handleSourceFile(file)} />}
        <EditorInputBar onSourceFile={(file) => void handleSourceFile(file)} />
      </div>

      <DiffViewer />
    </main>
  );
}
