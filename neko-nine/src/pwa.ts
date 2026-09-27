let pendingWorker: ServiceWorker | null = null;

export function registerPwa(onUpdate: () => void) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator))
    return () => undefined;
  let cancelled = false;
  const register = async () => {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    );
    if (registration.waiting && navigator.serviceWorker.controller) {
      pendingWorker = registration.waiting;
      onUpdate();
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (
          !cancelled &&
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          pendingWorker = worker;
          onUpdate();
        }
      });
    });
  };
  void register().catch(() => undefined);
  const onController = () => {
    if (pendingWorker) window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", onController);
  return () => {
    cancelled = true;
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      onController,
    );
  };
}

export function activateUpdate() {
  pendingWorker?.postMessage({ type: "SKIP_WAITING" });
}
