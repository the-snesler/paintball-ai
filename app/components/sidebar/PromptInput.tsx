import { Wand2 } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";

export function PromptInput() {
  const prompt = useGalleryStore((s) => s.currentPrompt);
  const setPrompt = useGalleryStore((s) => s.setPrompt);
  const addReferenceImage = useGalleryStore((s) => s.addReferenceImage);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          addReferenceImage({
            id: crypto.randomUUID(),
            blob: file,
            url,
            name: file.name,
          });
        }
      }
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Prompt
        </h2>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onPaste={handlePaste}
        placeholder="Describe your image..."
        className="w-full min-h-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors resize-y"
      />
    </section>
  );
}
