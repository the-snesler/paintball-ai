import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import { useEditorStore } from "~/stores/editorStore";
import { EditorView } from "~/components/editor/EditorView";
import { saveReferenceImage } from "~/lib/db";

export default function EditorRoute() {
  const [searchParams] = useSearchParams();
  const imageId = searchParams.get("imageId");
  const navigate = useNavigate();

  const getItem = useGalleryStore((s) => s.getItem);
  const hasLoaded = useGalleryStore((s) => s.hasLoaded);
  const setSource = useEditorStore((s) => s.setSource);
  const currentSourceId = useEditorStore((s) => s.sourceGalleryItemId);

  const didInitRef = useRef(false);

  useEffect(() => {
    // Wait for gallery to finish loading before resolving gallery items
    if (!hasLoaded) return;
    // Don't re-initialize if already loaded the same image
    if (didInitRef.current && currentSourceId === imageId) return;

    if (!imageId) {
      // No imageId — empty editor (file drop / paste flow)
      didInitRef.current = true;
      return;
    }

    const item = getItem(imageId);

    if (!item || item.status !== "completed") {
      // Image not found or not ready — send back to gallery
      navigate("/", { replace: true });
      return;
    }

    didInitRef.current = true;

    // Save the image blob as a reference for editor retry support
    const refId = crypto.randomUUID();
    saveReferenceImage({
      id: refId,
      blob: item.originalBlob,
      name: `${item.modelName} - ${item.prompt.slice(0, 40)}`,
    })
      .then(() => {
        setSource({
          blob: item.originalBlob,
          prompt: item.prompt,
          galleryItemId: item.id,
          referenceId: refId,
        });
      })
      .catch(() => {
        // Fall back: set without saving reference
        setSource({
          blob: item.originalBlob,
          prompt: item.prompt,
          galleryItemId: item.id,
          referenceId: crypto.randomUUID(),
        });
      });
  }, [imageId, hasLoaded, getItem, navigate, setSource, currentSourceId]);

  return <EditorView />;
}
