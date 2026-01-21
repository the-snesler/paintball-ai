import type { Route } from "./+types/home";
import { useEffect } from "react";
import { Sidebar, MobileSidebar } from "~/components/sidebar/Sidebar";
import { MobileHeader } from "~/components/sidebar/MobileHeader";
import { Gallery } from "~/components/gallery/Gallery";
import { SettingsModal } from "~/components/settings/SettingsModal";
import { Lightbox } from "~/components/lightbox/Lightbox";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Paintball - AI Image Generation" },
    { name: "description", content: "Generate images with AI models" },
  ];
}

export default function Home() {
  const loadImages = useGalleryStore((s) => s.loadImages);
  const hasLoaded = useGalleryStore((s) => s.hasLoaded);
  const isLightboxOpen = useGalleryStore((s) => s.isLightboxOpen);
  const settingsModalOpen = useSettingsStore((s) => s.settingsModalOpen);

  useEffect(() => {
    if (!hasLoaded) {
      loadImages();
    }
  }, [hasLoaded, loadImages]);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <MobileHeader />
      <MobileSidebar />
      <Sidebar />
      <Gallery />
      {settingsModalOpen && <SettingsModal />}
      {isLightboxOpen && <Lightbox />}
    </div>
  );
}
