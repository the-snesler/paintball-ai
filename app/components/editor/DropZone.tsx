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
      className="flex h-[calc(100%-7rem)] flex-1 items-center justify-center p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label
        className={`relative flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-3 border-dashed transition-all duration-200 ${
          isDragOver
            ? "border-accent bg-accent/5 scale-[1.02]"
            : "border-c-border hover:border-c-border hover:bg-surface-raised"
        }`}
      >
        <SineWaveGrid
          gridSize={32}
          radius={100}
          opacity={0.7}
          maxCellSizePct={0.5}
        />

        <input type="file" accept="image/*" onChange={handleChange} className="hidden" />

        <div
          className={`z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
            isDragOver ? "bg-accent/20" : "bg-surface-overlay"
          }`}
        >
          <ImagePlus
            className={`z-10 h-7 w-7 transition-colors ${
              isDragOver ? "text-accent-muted" : "text-text-muted"
            }`}
          />
        </div>

        <p className="text-text-secondary z-10 mb-1 text-sm font-medium">
          {isDragOver ? "Drop to open in editor" : "Drop an image to start editing"}
        </p>
        <p className="text-text-muted z-10 text-xs">or click to browse · paste an image below</p>
      </label>
    </div>
  );
}
