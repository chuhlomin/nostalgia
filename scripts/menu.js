import { playVideo, exitVideo } from "./player.js";
import { toggleFullScreen, updateMenuPath } from "./utils.js";

// Menu structure
export const menuStructure = {
  main: {
    header: "--------- MENU ---------",
    items: [
      {
        label: "CHANNEL LIST",
        action: "navigate",
        target: "channels",
      },
      {
        label: "OPTIONS",
        action: "navigate",
        target: "options",
      },
      { label: "INFO", action: "navigate", target: "info" },
    ],
  },
  options: {
    header: "------- OPTIONS --------",
    items: [
      {
        label: "SHADERS: ON",
        action: "toggle",
        states: ["SHADERS: ON", "SHADERS: OFF"],
        function: (item) => {
          if (item.label === "SHADERS: ON") {
            item.label = "SHADERS: OFF";
            localStorage.setItem("shadersEnabled", "false");
            window.toggleVHSShader(false);
          } else {
            item.label = "SHADERS: ON";
            localStorage.setItem("shadersEnabled", "true");
            window.toggleVHSShader(true);
          }

          renderMenu(currentMenu);
        },
      },
      {
        label: "FULLSCREEN: " + (document.fullscreenElement ? "ON" : "OFF"),
        action: "toggle",
        states: ["FULLSCREEN: ON", "FULLSCREEN: OFF"],
        function: (item) => {
          toggleFullScreen();
          if (document.fullscreenElement) {
            item.label = "FULLSCREEN: OFF";
          } else {
            item.label = "FULLSCREEN: ON";
          }
          renderMenu(currentMenu);
        },
      },
      { label: "BACK", action: "navigate", target: "main" },
    ],
  },
  info: {
    header: "--------- INFO ---------",
    items: [
      { label: "NOSTALGIA PLAYER", action: "none" },
      { label: "VERSION: 1.0", action: "none" },
      { label: "FONT - HOME VIDEO 0.8", action: "none" },
      { label: "BACK", action: "navigate", target: "main" },
    ],
  },
  // CHANNELS BEGIN
  channels: {
    header: "------- CHANNELS -------",
    items: [
      {
        label: "CARTOONS",
        action: "navigate",
        target: "cartoons",
      },
      {
        label: "BACK",
        action: "navigate",
        target: "main",
      },
    ],
  },
  cartoons: {
    header: "------- CARTOONS -------",
    items: [
      {
        label: "Аладдин",
        action: "play",
        video: "Аладдин.mp4",
        audio: "Аладдин_audio.mp4",
        subtitles: "Аладдин.vtt",
      },
      {
        label: "Команда Гуфи",
        action: "play",
        video: "Команда Гуфи.mp4",
      },
      {
        label: "Чёрный плащ",
        action: "play",
        video: "Чёрный плащ.mp4",
        audio: "Чёрный плащ_audio.mp4",
      },
      {
        label: "А может",
        action: "play",
        video: "А может.mp4",
        subtitles: "А может.vtt",
      },
      {
        label: "BACK",
        action: "navigate",
        target: "channels",
      },
    ],
  },
  // CHANNELS END
};

// Menu state
export let currentMenu = "main";
export let selectedIndex = 0;
export let menuHistory = {}; // Store selected indices for each menu

// Function to render the current menu
export function renderMenu(menuName) {
  const menu = menuStructure[menuName];
  const headerElement = document.getElementById("screen-header");
  const menuItemsElement = document.getElementById("menu-items");

  // Update header
  headerElement.textContent = menu.header;

  // Clear menu items
  menuItemsElement.innerHTML = "";

  // Add menu items
  menu.items.forEach((item, index) => {
    const menuItem = document.createElement("div");
    menuItem.classList.add("menu-item");
    menuItem.textContent = item.label;

    if (index === selectedIndex) {
      menuItem.classList.add("selected");
    }

    menuItem.addEventListener("click", () => {
      selectedIndex = index;
      handleMenuAction(item);
    });

    menuItemsElement.appendChild(menuItem);
  });

  if (window.requestTextureUpdate) {
    window.requestTextureUpdate();
  }
}

// Function to handle menu actions
export function handleMenuAction(item, fromUrl = false) {
  switch (item.action) {
    case "navigate":
      // Save current menu selection before navigating
      menuHistory[currentMenu] = selectedIndex;

      // Navigate to the target menu
      currentMenu = item.target;

      // Restore selection from history or default to 0
      selectedIndex = menuHistory[currentMenu] || 0;
      renderMenu(currentMenu);
      updateMenuPath();
      break;
    case "function":
      item.function();
      break;
    case "toggle":
      item.function(item);
      break;
    case "play":
      // First, make sure to exit any currently playing video
      exitVideo();
      playVideo(`channels/${currentMenu}/${item.video}`, item.label, fromUrl);
      break;
    case "none":
      // Do nothing for informational items
      break;
  }

  if (window.requestTextureUpdate) {
    window.requestTextureUpdate();
  }
}

// Function to parse URL and navigate to the specified menu or video
export function parseUrlAndNavigate() {
  if (window.location.hash) {
    const path = window.location.hash.substring(1).split("/");

    // Validate and navigate through each level
    let validPath = true;
    let currentMenuPath = "main";
    let potentialVideoName = null;

    for (let i = 0; i < path.length && validPath; i++) {
      const nextSegment = decodeURIComponent(path[i]);

      // If we're at the last segment, check if it might be a video
      if (i === path.length - 1) {
        // Check if this segment is a video in the current menu
        const videoItem = menuStructure[currentMenuPath]?.items.find(
          (item) => item.action === "play" && item.label === nextSegment,
        );

        if (videoItem) {
          potentialVideoName = nextSegment;
          break; // Found a video, stop processing
        }
      }

      // Check if this is a valid navigation target from current menu
      const targetItem = menuStructure[currentMenuPath].items.find(
        (item) => item.action === "navigate" && item.target === nextSegment,
      );

      if (targetItem) {
        // Save selection for current menu
        menuHistory[currentMenuPath] =
          menuStructure[currentMenuPath].items.indexOf(targetItem);
        currentMenuPath = nextSegment;
      } else {
        validPath = false;
      }
    }

    if (validPath) {
      // Set the current menu
      if (currentMenuPath !== "main") {
        currentMenu = currentMenuPath;
        selectedIndex = menuHistory[currentMenu] || 0;
      }

      // Render the current menu
      renderMenu(currentMenu);

      // If we found a video, play it
      if (potentialVideoName) {
        const videoItem = menuStructure[currentMenu].items.find(
          (item) => item.action === "play" && item.label === potentialVideoName,
        );

        if (videoItem) {
          // Set selected index to the video item
          selectedIndex = menuStructure[currentMenu].items.indexOf(videoItem);
          // Play the video
          setTimeout(() => handleMenuAction(videoItem, true), 100);
        }
      }
    } else {
      // If path is invalid, just render main menu
      currentMenu = "main";
      selectedIndex = 0;
      renderMenu(currentMenu);
    }
  } else {
    // Render the current menu (defaults to main if URL parsing failed)
    renderMenu(currentMenu);
  }
}

// Handle keyboard navigation
export function setupKeyboardNavigation() {
  document.addEventListener("keydown", (event) => {
    // If video is playing and Escape is pressed, exit the video
    const videoContainer = document.getElementById("video-container");
    if (
      videoContainer.classList.contains("fullscreen-video") &&
      event.key === "Escape"
    ) {
      // This will be handled by the specific video escape handler
      return;
    }

    const menu = menuStructure[currentMenu];
    const previousIndex = selectedIndex;

    switch (event.key) {
      case "f":
        toggleFullScreen();
        break;
      case "s":
        // Get the shaders option to toggle it
        const shadersOption = menuStructure.options.items.find(
          (item) =>
            item.states &&
            (item.states[0] === "SHADERS: ON" ||
              item.states[1] === "SHADERS: ON"),
        );

        if (shadersOption) {
          // Check if shaders are currently enabled
          const currentlyEnabled =
            document.body.classList.contains("shader-enabled");
          // Toggle to opposite state
          const newState = !currentlyEnabled;

          // Update the shadersOption label
          shadersOption.label = newState ? "SHADERS: ON" : "SHADERS: OFF";

          // Store the new preference
          localStorage.setItem("shadersEnabled", newState.toString());

          if (currentMenu === "options") {
            renderMenu(currentMenu);
          }
          // Apply the new shader state
          window.toggleVHSShader(newState);
        }
        break;
      case "ArrowUp":
        // if video is playing, handle up and down keys for volume control
        if (videoContainer.classList.contains("fullscreen-video")) {
          const videoPlayer = document.getElementById("video-player");
          if (event.shiftKey) {
            // Shift + ArrowUp: Increase volume
            videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1);
          } else {
            // ArrowUp: Increase volume
            videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.05);
          }
          return;
        }

        selectedIndex =
          (selectedIndex - 1 + menu.items.length) % menu.items.length;
        renderMenu(currentMenu);
        break;
      case "ArrowDown":
        // if video is playing, handle up and down keys for volume control
        if (videoContainer.classList.contains("fullscreen-video")) {
          const videoPlayer = document.getElementById("video-player");
          if (event.shiftKey) {
            // Shift + ArrowDown: Decrease volume
            videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1);
          } else {
            // ArrowDown: Decrease volume
            videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.05);
          }
          return;
        }
        selectedIndex = (selectedIndex + 1) % menu.items.length;
        renderMenu(currentMenu);
        break;
      case "ArrowLeft":
        // if video is playing, handle left and right keys for seeking
        if (videoContainer.classList.contains("fullscreen-video")) {
          const videoPlayer = document.getElementById("video-player");
          if (event.shiftKey) {
            // Shift + ArrowLeft: Seek back 10 seconds
            videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
          } else {
            // ArrowLeft: Seek back 5 seconds
            videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
          }
          return;
        }

        // handle back action
        if (currentMenu !== "main") {
          // Navigate back to the previous menu
          // Find the previous menu
          let previousMenu = "main";
          for (const key in menuStructure) {
            if (
              menuStructure[key].items.some(
                (item) => item.target === currentMenu,
              )
            ) {
              previousMenu = key;
              break;
            }
          }

          // Save current selection before navigating away
          menuHistory[currentMenu] = selectedIndex;

          // Navigate to previous menu and restore selection
          currentMenu = previousMenu;
          selectedIndex = menuHistory[currentMenu] || 0;
          renderMenu(currentMenu);
          updateMenuPath();
        }
        break;
      case "ArrowRight":
        // if video is playing, handle left and right keys for seeking
        if (videoContainer.classList.contains("fullscreen-video")) {
          const videoPlayer = document.getElementById("video-player");
          if (event.shiftKey) {
            // Shift + ArrowRight: Seek forward 10 seconds
            videoPlayer.currentTime = Math.min(
              videoPlayer.duration,
              videoPlayer.currentTime + 10,
            );
          } else {
            // ArrowRight: Seek forward 5 seconds
            videoPlayer.currentTime = Math.min(
              videoPlayer.duration,
              videoPlayer.currentTime + 5,
            );
          }
          return;
        }
      case "Enter":
      case "Space":
        handleMenuAction(menu.items[selectedIndex]);
        break;
    }

    // Request texture update AFTER the UI has been updated
    setTimeout(() => {
      if (window.requestTextureUpdate) {
        window.requestTextureUpdate();
      }
    }, 0);
  });
}
