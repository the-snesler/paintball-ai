import { useLayoutEffect, useRef } from "react";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { ApiKeysSection } from "./ApiKeysSection";
import { CharactersSection } from "./CharactersSection";
import { DataSection } from "./DataSection";
import { EditorSection } from "./EditorSection";
import { GallerySection } from "./GallerySection";
import { ImageModelsSection } from "./ImageModelsSection";
import { StylesSection } from "./StylesSection";
import { TextModelsSection } from "./TextModelsSection";

// Keep the container's position across route changes for this app session.
let settingsScrollTop = 0;

export function SettingsModal() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = settingsScrollTop;
    return () => {
      settingsScrollTop = container.scrollTop;
    };
  }, []);

  return (
    <main className="bg-surface flex h-full flex-1 flex-col overflow-hidden">
      <GalleryHeader title="Settings" />

      <div
        ref={scrollRef}
        id="settings-scroll"
        className="flex-1 space-y-6 overflow-y-auto p-4 md:py-4 md:pr-4 md:pl-88"
      >
        <ApiKeysSection />
        <ImageModelsSection />
        <CharactersSection />
        <StylesSection />
        <TextModelsSection />
        <GallerySection />
        <EditorSection />
        <DataSection />
      </div>
    </main>
  );
}
