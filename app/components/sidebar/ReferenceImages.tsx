import { ImagePlus, X } from "lucide-react";
import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";

export function ReferenceImages() {
  const referenceImages = useGalleryStore((s) => s.currentReferenceImages);
  const addReferenceImage = useGalleryStore((s) => s.addReferenceImage);
  const removeReferenceImage = useGalleryStore((s) => s.removeReferenceImage);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Check for image data from gallery drag
      const imageData = e.dataTransfer.getData("application/json");
      if (imageData) {
        try {
          const { id, blob, name } = JSON.parse(imageData);
          // Convert base64 back to blob if needed
          if (typeof blob === "string") {
            fetch(blob)
              .then((res) => res.blob())
              .then((blobData) => {
                addReferenceImage({
                  id: crypto.randomUUID(),
                  blob: blobData,
                  url: blob,
                  name: name || "Gallery image",
                });
              });
          }
        } catch {
          // Not JSON, try files
        }
      }

      // Handle file drops
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );

      for (const file of files) {
        const url = URL.createObjectURL(file);
        addReferenceImage({
          id: crypto.randomUUID(),
          blob: file,
          url,
          name: file.name,
        });
      }
    },
    [addReferenceImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      for (const file of files) {
        const url = URL.createObjectURL(file);
        addReferenceImage({
          id: crypto.randomUUID(),
          blob: file,
          url,
          name: file.name,
        });
      }

      // Reset input
      e.target.value = "";
    },
    [addReferenceImage]
  );

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <ImagePlus className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Reference Images
        </h2>
      </div>

      {/* Drop zone / Preview area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-zinc-700 rounded-lg p-3 hover:border-zinc-600 transition-colors"
      >
        {referenceImages.length === 0 ? (
          <label className="flex flex-col items-center justify-center py-4 cursor-pointer">
            <ImagePlus className="w-6 h-6 text-zinc-600 mb-2" />
            <span className="text-xs text-zinc-500">Add images for editing</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="max-w-full grid grid-cols-3 gap-2">
              {referenceImages.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover rounded"
                  />
                  <button
                    onClick={() => removeReferenceImage(img.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center py-2 cursor-pointer text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
              <ImagePlus className="w-4 h-4 mr-1" />
              Add more
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
