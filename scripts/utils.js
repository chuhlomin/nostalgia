import {
  currentMenu,
  selectedIndex,
  menuStructure,
  renderState,
} from "./menu.js";

// Function to toggle fullscreen
export function toggleFullScreen() {
  if (!document.fullscreenElement) {
    // If not in fullscreen mode, request fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      // Firefox
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      // Chrome, Safari, Opera
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      // IE/Edge
      document.documentElement.msRequestFullscreen();
    }
  } else {
    // If already in fullscreen mode, exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      // Firefox
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      // Chrome, Safari, Opera
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      // IE/Edge
      document.msExitFullscreen();
    }
  }

  // Request texture update after fullscreen toggle
  setTimeout(() => {
    if (window.requestTextureUpdate) {
      window.requestTextureUpdate();
    }
  }, 200); // Small delay to ensure fullscreen animation completes

  // update fullscreen option label
  const fullscreenOption = menuStructure.options.items.find(
    (item) =>
      item.states &&
      (item.states[0] === "FULLSCREEN: ON" ||
        item.states[1] === "FULLSCREEN: ON"),
  );
  if (fullscreenOption) {
    fullscreenOption.label = document.fullscreenElement
      ? "FULLSCREEN: OFF"
      : "FULLSCREEN: ON";
  }

  // if current screen is options, re-render to update fullscreen option
  if (currentMenu === "options") {
    renderState(currentMenu);
  }
}

// Function to update URL with current menu path
export function updateMenuPath(videoPlaying = null) {
  // Build path based on current menu and navigation history
  let path = "";

  // Special case for main menu - we don't need a hash
  if (currentMenu !== "main") {
    // Find the path by traversing backwards
    let menuPath = [];
    let targetMenu = currentMenu;

    while (targetMenu !== "main") {
      menuPath.unshift(targetMenu);
      // Find parent menu
      let found = false;
      for (const key in menuStructure) {
        if (
          menuStructure[key].items.some((item) => item.target === targetMenu)
        ) {
          targetMenu = key;
          found = true;
          break;
        }
      }
      if (!found) break; // Safety check
    }

    path = "#" + menuPath.join("/");

    // Add video to path if playing
    if (videoPlaying) {
      path += "/" + encodeURIComponent(videoPlaying);
    }
  }

  // Update URL without reloading the page
  if (window.location.hash !== path) {
    history.replaceState(null, "", path || "#");
  }
}

// Load preferences from localStorage
export function loadPreferences() {
  // Load shader preference
  const shadersEnabled = localStorage.getItem("shadersEnabled");
  if (shadersEnabled !== null) {
    const enabled = shadersEnabled === "true";
    window.toggleVHSShader(enabled);
    // Update the menu item label
    const shadersOption = menuStructure.options.items.find(
      (item) =>
        item.states &&
        (item.states[0] === "SHADERS: ON" || item.states[1] === "SHADERS: ON"),
    );
    if (shadersOption) {
      shadersOption.label = enabled ? "SHADERS: ON" : "SHADERS: OFF";
    }
  } else {
    // Default to shaders on if no preference is stored
    window.toggleVHSShader(true);
  }
}
