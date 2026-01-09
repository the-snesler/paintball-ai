import { Wand2 } from "lucide-react";
import { useGenerationStore } from "~/stores/generationStore";

export function PromptInput() {
  const prompt = useGenerationStore((s) => s.prompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);

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
        placeholder="Describe your image..."
        className="w-full h-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
      />
    </section>
  );
}
