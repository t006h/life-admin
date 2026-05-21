/**
 * Life Admin — production boot: loading overlay, global errors, PWA registration
 */
(function () {
  const LOADER_ID = "appBootLoader";
  const ERROR_ID = "appBootError";

  function showLoader(message) {
    const el = document.getElementById(LOADER_ID);
    const text = document.getElementById("appBootLoaderText");
    if (text && message) text.textContent = message;
    if (el) el.hidden = false;
  }

  function hideLoader() {
    const el = document.getElementById(LOADER_ID);
    if (el) el.hidden = true;
  }

  function showFatalError(message, detail) {
    hideLoader();
    const el = document.getElementById(ERROR_ID);
    const msg = document.getElementById("appBootErrorMessage");
    const det = document.getElementById("appBootErrorDetail");
    if (msg) msg.textContent = message || "Something went wrong";
    if (det) det.textContent = detail || "";
    if (el) el.hidden = false;
  }

  function hideFatalError() {
    const el = document.getElementById(ERROR_ID);
    if (el) el.hidden = true;
  }

  window.addEventListener("error", (ev) => {
    const msg = ev.message || "Unexpected error";
    if (!window.__LIFE_ADMIN_BOOTED__) {
      showFatalError("Life Admin could not start", msg);
    } else {
      window.LifeAdminApp?.showError?.(msg);
    }
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const msg = ev.reason?.message || String(ev.reason || "Request failed");
    if (!window.__LIFE_ADMIN_BOOTED__) {
      showFatalError("Life Admin could not start", msg);
    }
  });

  document.getElementById("appBootErrorRetry")?.addEventListener("click", () => {
    location.reload();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.warn("Service worker registration failed:", err.message);
      });
    });
  }

  let deferredInstall;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    const btn = document.getElementById("btnInstallPwa");
    if (btn) btn.hidden = false;
  });

  document.getElementById("btnInstallPwa")?.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    const btn = document.getElementById("btnInstallPwa");
    if (btn) btn.hidden = true;
  });

  showLoader("Loading Life Admin…");

  window.LifeAdminDeploy = {
    showLoader,
    hideLoader,
    showFatalError,
    hideFatalError,
    markBooted() {
      window.__LIFE_ADMIN_BOOTED__ = true;
      hideLoader();
      hideFatalError();
    },
  };
})();
