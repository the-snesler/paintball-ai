import { ImagePlus } from "lucide-react";
import { useCallback, useState } from "react";

interface DropZoneProps {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div
      className="flex-1 flex items-center justify-center p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label
        className={`relative flex flex-col items-center justify-center w-full max-w-md aspect-video rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-purple-500 bg-purple-500/5 scale-[1.02]"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />

        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
            isDragOver ? "bg-purple-500/20" : "bg-zinc-800"
          }`}
        >
          <ImagePlus
            className={`w-7 h-7 transition-colors ${
              isDragOver ? "text-purple-400" : "text-zinc-500"
            }`}
          />
        </div>

        <p className="text-sm font-medium text-zinc-300 mb-1">
          {isDragOver ? "Drop to open in editor" : "Drop an image to start editing"}
        </p>
        <p className="text-xs text-zinc-600">
          or click to browse · paste an image below
        </p>
      </label>
    </div>
  );
}
