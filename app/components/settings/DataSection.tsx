import { Archive, Download, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getImageCount } from "~/lib/db";
import { exportAllImages, importFromZip } from "~/lib/exportImport";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function DataSection() {
  const loadImages = useGalleryStore((s) => s.loadImages);
  const characterCount = useSettingsStore((s) => s.characters.length);
  const styleCount = useSettingsStore((s) => s.styles.filter((style) => style.isCustom).length);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageCount, setImageCount] = useState<number>(-1);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getImageCount().then(setImageCount);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await exportAllImages();
      setStatus("Export complete.");
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);
    try {
      const result = await importFromZip(file);
      const parts = [`${result.imported} generations imported`];
      if (result.referencesImported > 0) {
        parts.push(`${result.referencesImported} references imported`);
      }
      if (result.charactersImported > 0) {
        parts.push(
          `${result.charactersImported} character${result.charactersImported !== 1 ? "s" : ""} imported`
        );
      }
      if (result.stylesImported > 0) {
        parts.push(
          `${result.stylesImported} custom style${result.stylesImported !== 1 ? "s" : ""} imported`
        );
      }
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (already exist)`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setStatus(parts.join(", "));

      if (result.imported > 0) {
        await loadImages();
        setImageCount(await getImageCount());
      }
    } catch (error) {
      setStatus(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section id="data" className="group space-y-3">
      <SettingsSectionHeader
        icon={Archive}
        title="Data"
        subtitle={`Export or import all ${imageCount} gallery image${imageCount !== 1 ? "s" : ""}, ${characterCount} character${characterCount !== 1 ? "s" : ""}, and ${styleCount} custom style${styleCount !== 1 ? "s" : ""} as a ZIP file.`}
      />

      <div className="ml-6 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || importing || imageCount === 0}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exporting..." : "Export all images"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={exporting || importing}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {importing ? "Importing..." : "Import from ZIP"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {status && <p className="text-text-tertiary text-xs">{status}</p>}
      </div>
    </section>
  );
}
