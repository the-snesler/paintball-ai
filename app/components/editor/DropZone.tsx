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
      className="flex flex-1 items-center justify-center p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label
        className={`relative flex aspect-video w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? "scale-[1.02] border-purple-500 bg-purple-500/5"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900"
        }`}
      >
        <input type="file" accept="image/*" onChange={handleChange} className="hidden" />

        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
            isDragOver ? "bg-purple-500/20" : "bg-zinc-800"
          }`}
        >
          <ImagePlus
            className={`h-7 w-7 transition-colors ${
              isDragOver ? "text-purple-400" : "text-zinc-500"
            }`}
          />
        </div>

        <p className="mb-1 text-sm font-medium text-zinc-300">
          {isDragOver ? "Drop to open in editor" : "Drop an image to start editing"}
        </p>
        <p className="text-xs text-zinc-600">or click to browse · paste an image below</p>
      </label>
    </div>
  );
}
