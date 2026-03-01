import type { Route } from "./+types/home";
import { useEffect, useRef } from "react";
import { Sidebar, MobileSidebar } from "~/components/sidebar/Sidebar";
import { MobileHeader } from "~/components/sidebar/MobileHeader";
import { Gallery } from "~/components/gallery/Gallery";
import { SettingsModal } from "~/components/settings/Settings";
import { NotificationPermissionPrompt } from "~/components/settings/NotificationPermissionPrompt";
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
  const activeMainPanel = useGalleryStore((s) => s.activeMainPanel);
  const isLightboxOpen = useGalleryStore((s) => s.isLightboxOpen);
  const items = useGalleryStore((s) => s.items);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const previousInFlightCountRef = useRef(0);

  useEffect(() => {
    if (!hasLoaded) {
      loadImages();
    }
  }, [hasLoaded, loadImages]);

  useEffect(() => {
    const inFlightCount = items.filter(
      (item) => item.status === "pending" || item.status === "generating" || item.status === "waiting"
    ).length;
    const hadInFlight = previousInFlightCountRef.current > 0;

    previousInFlightCountRef.current = inFlightCount;

    if (!hadInFlight || inFlightCount !== 0) {
      return;
    }

    if (!desktopNotificationsEnabled) {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    if (!document.hidden && document.hasFocus()) {
      return;
    }

    new Notification("Paintball", {
      body: "All generations are complete.",
      tag: "paintball-generation-complete",
    });
  }, [items, desktopNotificationsEnabled]);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <MobileHeader />
      <MobileSidebar />
      <Sidebar />
      {activeMainPanel === "settings" ? <SettingsModal /> : <Gallery />}
      {isLightboxOpen && <Lightbox />}
      <NotificationPermissionPrompt />
    </div>
  );
}
