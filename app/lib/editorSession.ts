import { getImageById, getReferenceImagesByIds } from "~/lib/db";
import type { EditorTurn, ReferenceImage, StoredEditorSession } from "~/types";

export interface HydratedSession {
  sessionId: string;
  sourceBlob: Blob;
  sourceUrl: string;
  sourcePrompt: string;
  sourceGalleryItemId: string | null;
  sourceReferenceId: string | null;
  turns: EditorTurn[];
  selectedItemId: string | null;
  referenceImages: ReferenceImage[];
  /**
   * Object URLs created during hydration that the caller owns.
   * Pass these to hydrateSession (which transfers ownership to the store),
   * or revoke them if the operation is cancelled.
   */
  createdUrls: string[];
}

/**
 * Fetch blobs and hydrate a stored editor session into its fully in-memory form.
 * Returns null if the source reference is missing (session is unrestorable).
 *
 * The caller is responsible for either:
 *   (a) Passing the result to `hydrateSession` (store takes ownership of URLs), or
 *   (b) Revoking `result.createdUrls` if the restore is cancelled.
 */
export async function hydrateStoredSession(
  session: StoredEditorSession
): Promise<HydratedSession | null> {
  // IDs that end up as tracked URLs in the store (source + additional refs)
  const urlNeededIds = new Set([
    ...(session.sourceReferenceId ? [session.sourceReferenceId] : []),
    ...session.additionalReferenceIds,
  ]);

  // Turn source IDs that only need blobs (Turn.tsx creates its own URLs from the blob)
  const turnSourceIds = session.turns.map((t) => t.sourceReferenceId);
  const blobOnlyIds = turnSourceIds.filter((id) => !urlNeededIds.has(id));

  const allRefIds = [...new Set([...urlNeededIds, ...blobOnlyIds])];
  const fetchedRefs = await getReferenceImagesByIds(allRefIds);
  const refMap = new Map(fetchedRefs.map((r) => [r.id, r]));

  // Revoke URLs for blob-only refs — Turn.tsx creates its own URLs from the blob as needed
  for (const ref of fetchedRefs) {
    if (blobOnlyIds.includes(ref.id)) URL.revokeObjectURL(ref.url);
  }

  // Track only the URLs that will be managed by the store
  const createdUrls = fetchedRefs.filter((r) => urlNeededIds.has(r.id)).map((r) => r.url);

  // Validate turn itemIds — prune gallery items that no longer exist
  const validatedItemIds: Record<string, string[]> = {};
  await Promise.all(
    session.turns.map(async (turn) => {
      const checks = await Promise.all(turn.itemIds.map((id) => getImageById(id)));
      const surviving = turn.itemIds.filter((_id, i) => checks[i] !== null);
      if (surviving.length < turn.itemIds.length) {
        console.warn(
          `[EditorSession] Pruned ${turn.itemIds.length - surviving.length} stale item(s) from turn ${turn.id}`
        );
      }
      validatedItemIds[turn.id] = surviving;
    })
  );

  // Hydrate EditorTurn objects
  const hydratedTurns: EditorTurn[] = [];
  for (const t of session.turns) {
    const ref = refMap.get(t.sourceReferenceId);
    if (!ref) {
      console.warn(`[EditorSession] Missing reference blob for turn ${t.id} — skipping turn`);
      continue;
    }
    hydratedTurns.push({
      id: t.id,
      instruction: t.instruction,
      sentInstruction: t.sentInstruction,
      sourceItemId: t.sourceItemId,
      sourceBlob: ref.blob,
      sourceReferenceId: t.sourceReferenceId,
      itemIds: validatedItemIds[t.id] ?? [],
      createdAt: t.createdAt,
      contextBrief: t.contextBrief,
    });
  }

  // Hydrate additional reference images
  const additionalRefs: ReferenceImage[] = session.additionalReferenceIds
    .map((id) => refMap.get(id))
    .filter((r): r is ReferenceImage => r != null);

  // Resolve source
  const sourceRef = session.sourceReferenceId ? refMap.get(session.sourceReferenceId) : null;
  if (!sourceRef) {
    console.warn("[EditorSession] Source reference not found — cannot restore session");
    createdUrls.forEach((url) => URL.revokeObjectURL(url));
    return null;
  }

  return {
    sessionId: session.id,
    sourceBlob: sourceRef.blob,
    sourceUrl: sourceRef.url,
    sourcePrompt: session.sourcePrompt,
    sourceGalleryItemId: session.sourceGalleryItemId,
    sourceReferenceId: session.sourceReferenceId,
    turns: hydratedTurns,
    selectedItemId: session.selectedItemId,
    referenceImages: additionalRefs,
    createdUrls,
  };
}
