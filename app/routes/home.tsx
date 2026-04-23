import type { Route } from "./+types/home";
import { useEffect, useRef } from "react";
import { Outlet } from "react-router";
import { Sidebar, MobileSidebar } from "~/components/sidebar/Sidebar";
import { MobileHeader } from "~/components/sidebar/MobileHeader";
import { NotificationPermissionPrompt } from "~/components/settings/NotificationPermissionPrompt";
import { Lightbox } from "~/components/lightbox/Lightbox";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useGalleryDerivedIndexes } from "~/hooks/useGalleryDerivedIndexes";
import { useLightboxUrlSync } from "~/hooks/useLightboxUrlSync";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Paintball - AI Image Generation" },
    { name: "description", content: "Generate images with AI models" },
  ];
}

export default function Home() {
  const loadImages = useGalleryStore((s) => s.loadImages);
  const hasLoaded = useGalleryStore((s) => s.hasLoaded);
  const isLightboxOpen = useLightboxStore((s) => s.isLightboxOpen);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const { inFlightCount } = useGalleryDerivedIndexes();
  useLightboxUrlSync();
  const previousInFlightCountRef = useRef(0);

  useEffect(() => {
    if (!hasLoaded) {
      loadImages();
    }
  }, [hasLoaded, loadImages]);

  useEffect(() => {
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
  }, [inFlightCount, desktopNotificationsEnabled]);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <MobileHeader />
      <MobileSidebar />
      <Sidebar />
      <Outlet />
      {isLightboxOpen && <Lightbox />}
      <NotificationPermissionPrompt />
    </div>
  );
}
