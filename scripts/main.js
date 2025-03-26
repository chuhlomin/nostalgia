import { setupVHSShader } from "./vhs-shader.js";
import { loadPreferences } from "./utils.js";
import {
  parseUrlAndNavigate,
  setupKeyboardNavigation,
  setupCanvas,
} from "./menu.js";

// Initial setup
document.addEventListener("DOMContentLoaded", function () {
  const font = new FontFace(
    "Home Video",
    "url('./fonts/HomeVideo-Regular.woff2') format('woff2'), " +
      "url('./fonts/HomeVideo-Regular.woff') format('woff'), " +
      "url('./fonts/HomeVideo-Regular.ttf') format('truetype')",
  );
  font
    .load()
    .then(function (loadedFont) {
      document.fonts.add(loadedFont);

      setupVHSShader();
      loadPreferences();

      setupCanvas();
      parseUrlAndNavigate();
      setupKeyboardNavigation();

      // Listen for URL changes (back/forward navigation)
      window.addEventListener("popstate", parseUrlAndNavigate);
    })
    .catch((error) => {
      console.error("Error loading font:", error);
    });
});
