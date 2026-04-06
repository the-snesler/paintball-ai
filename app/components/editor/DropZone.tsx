import { ImagePlus } from "lucide-react";
import { useCallback, useState } from "react";
import { SineWaveGrid } from "../gallery/SineWaveGrid";

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
        className={`relative flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-3 border-dashed transition-all duration-200 ${
          isDragOver
            ? "scale-[1.02] border-purple-500 bg-purple-500/5"
            : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900"
        }`}
      >
        <SineWaveGrid
          gridSize={32}
          radius={100}
          opacity={0.7}
          maxCellSizePct={0.5}
          backgroundColor="#09090b"
        />

        <input type="file" accept="image/*" onChange={handleChange} className="hidden" />

        <div
          className={`z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
            isDragOver ? "bg-purple-500/20" : "bg-zinc-800"
          }`}
        >
          <ImagePlus
            className={`z-10 h-7 w-7 transition-colors ${
              isDragOver ? "text-purple-400" : "text-zinc-500"
            }`}
          />
        </div>

        <p className="z-10 mb-1 text-sm font-medium text-zinc-300">
          {isDragOver ? "Drop to open in editor" : "Drop an image to start editing"}
        </p>
        <p className="z-10 text-xs text-zinc-600">or click to browse · paste an image below</p>
      </label>
    </div>
  );
}
