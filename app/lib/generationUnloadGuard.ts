let activeGenerations = 0;

function handleBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

/** Keep the tab-close warning active until every overlapping generation settles. */
export function beginGenerationUnloadGuard(): () => void {
  if (activeGenerations++ === 0) {
    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  return () => {
    if (--activeGenerations === 0) {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  };
}
