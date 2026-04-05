import { useEditorStore } from "~/stores/editorStore";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { TurnList } from "./TurnList";
import { EditorInputBar } from "./EditorInputBar";
import { DropZone } from "./DropZone";
import { saveReferenceImage } from "~/lib/db";

export function EditorView() {
  const hasSource = useEditorStore((s) => s.sourceBlob !== null);
  const sourcePrompt = useEditorStore((s) => s.sourcePrompt);
  const setSource = useEditorStore((s) => s.setSource);

  const editorTitle = hasSource && sourcePrompt
    ? `Editor · ${sourcePrompt}`
    : "Editor";

  const handleSourceFile = async (file: File) => {
    const refId = crypto.randomUUID();
    await saveReferenceImage({ id: refId, blob: file, name: file.name });
    setSource({
      blob: file,
      prompt: file.name.replace(/\.[^.]+$/, ""),
      referenceId: refId,
    });
  };

  return (
    <main className="relative flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      <GalleryHeader title={editorTitle} />

      {hasSource ? (
        <TurnList />
      ) : (
        <DropZone onFile={(file) => void handleSourceFile(file)} />
      )}

      <EditorInputBar onSourceFile={(file) => void handleSourceFile(file)} />
    </main>
  );
}
