import { setupVHSShader } from "./vhs-shader.js";
import { loadPreferences } from "./utils.js";
import { parseUrlAndNavigate, setupKeyboardNavigation } from "./menu.js";

// Initial setup
document.addEventListener("DOMContentLoaded", function () {
  setupVHSShader();
  loadPreferences();
  parseUrlAndNavigate();
  setupKeyboardNavigation();

  // Listen for URL changes (back/forward navigation)
  window.addEventListener("popstate", parseUrlAndNavigate);
});
