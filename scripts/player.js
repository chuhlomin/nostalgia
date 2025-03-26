import { updateMenuPath } from "./utils.js";
import { renderState } from "./menu.js";

// Function to handle video playback
export function playVideo(videoPath, videoTitle, fromUrl = false) {
  const videoContainer = document.getElementById("video-container");

  // Create video and audio elements
  // const audioPath = videoPath.replace(".mp4", "_audio.mp4");
  const audioPath = videoPath.replace(".mp4", "_audio.mp4");
  const subtitlesPath = videoPath.replace(".mp4", ".vtt");

  videoContainer.innerHTML = `
    <div id="video-container" class="video-wrapper">
      <video id="video-player">
        <source src="${videoPath}" type="video/mp4">
        <track id="subtitles-track" kind="subtitles" src="${subtitlesPath}" srclang="ru" label="Russian" default>
        Your browser does not support the video tag.
      </video>
    </div>
    <audio id="audio-player" style="display: none;">
      <source src="${audioPath}" type="audio/mp4">
    </audio>
  `;
  // Add fullscreen class to video container
  videoContainer.classList.add("fullscreen-video");

  // Set up video player controls
  const videoPlayer = document.getElementById("video-player");
  const audioPlayer = document.getElementById("audio-player");
  const subtitlesTrack = document.getElementById("subtitles-track");

  // Auto focus the video for keyboard controls
  videoPlayer.focus();

  // Mute video player by default
  videoPlayer.muted = true;

  // Add event listener for video ended
  videoPlayer.addEventListener("ended", exitVideo);

  // Set up error handling for audio
  audioPlayer.querySelector("source").addEventListener("error", (err) => {
    console.log("Audio playback error - falling back to video audio", err);
    videoPlayer.muted = false;
    if (audioPlayer) audioPlayer.remove();
  });
  audioPlayer.load();

  // Try to play audio when video plays
  videoPlayer.addEventListener("play", () => {
    audioPlayer.currentTime = videoPlayer.currentTime;
    const audioPromise = audioPlayer.play();

    if (audioPromise !== undefined) {
      audioPromise.catch((error) => {
        console.log("Audio play error:", error);
        videoPlayer.muted = false;
        if (audioPlayer) audioPlayer.remove();
      });
    }
  });

  videoPlayer.addEventListener("pause", () => {
    audioPlayer.pause();
  });

  videoPlayer.addEventListener("seeked", () => {
    audioPlayer.currentTime = videoPlayer.currentTime;
  });

  // Set up custom subtitles display
  if (subtitlesTrack) {
    videoPlayer.addEventListener("timeupdate", () => {
      updateCustomSubtitles(videoPlayer, subtitlesTrack);
    });

    // Also update on cuechange events
    subtitlesTrack.track.addEventListener("cuechange", () => {
      updateCustomSubtitles(videoPlayer, subtitlesTrack);
    });

    // Load subtitles and handle errors gracefully
    subtitlesTrack.addEventListener("error", (e) => {
      console.log("Subtitles not available:", e);
      // Clear error message after a moment
      setTimeout(() => {
        customSubtitlesContainer.textContent = "";
      }, 3000);
    });
  }

  if (!fromUrl) {
    videoPlayer.play();
  } else {
    // wait for the video to load, then request a texture update
    videoPlayer.addEventListener("loadeddata", () => {
      if (window.requestTextureUpdate) {
        window.requestTextureUpdate();
      }
    });
  }

  // Add event listener for the Escape key to exit video
  const escapeHandler = (e) => {
    if (e.key === "Escape" || e.key === "q") {
      e.preventDefault(); // Prevent exiting fullscreen
      e.stopPropagation(); // Stop event propagation
      exitVideo();
      return false;
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault(); // Prevent page scrolling
      if (videoPlayer.paused) {
        videoPlayer.play();
        if (audioPlayer) audioPlayer.play();
      } else {
        videoPlayer.pause();
        if (audioPlayer) audioPlayer.pause();
      }
    }
  };

  // Use capture phase to intercept the event before it reaches the document
  document.addEventListener("keydown", escapeHandler, true);

  // Store the handler reference for later removal
  videoContainer.escapeHandler = escapeHandler;

  // Update URL to include video path
  updateMenuPath(videoTitle);
}

// Function to update custom subtitles display
export function updateCustomSubtitles(videoPlayer, subtitlesTrack) {
  if (!subtitlesTrack || !subtitlesTrack.track) return;

  const track = subtitlesTrack.track;

  // Check if track is loaded
  if (track.mode !== "showing") {
    track.mode = "showing";
  }

  // Get active cues
  if (track.activeCues && track.activeCues.length > 0) {
    const cue = track.activeCues[0];
    const currentTime = videoPlayer.currentTime;

    // subtitles are split into lines
    // each line is a list of words with time codes
    let result = [];

    // Check if the text contains time codes in the format <00:00.000>
    if (cue.text.includes("<") && cue.text.includes(">")) {
      // Parse the text with time codes
      const lines = cue.text.split("\n");

      // Process each line separately to maintain line breaks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let lineData = [];

        // Process timestamped words in the line
        if (line.includes("<") && line.includes(">")) {
          // Match all timestamps and the text between them
          const regex = /<(\d{2}:\d{2}\.\d{3})>([^<]*)/g;
          let matches = [];
          let match;

          // Find all timestamp-text pairs
          while ((match = regex.exec(line)) !== null) {
            const timeCode = match[1];
            const text = match[2].trim();

            // Convert time code to seconds
            let timeInSeconds;
            if (timeCode.includes(":")) {
              const parts = timeCode.split(":");
              if (parts.length === 3) {
                // Format: HH:MM:SS.mmm
                timeInSeconds =
                  parseInt(parts[0]) * 3600 +
                  parseInt(parts[1]) * 60 +
                  parseFloat(parts[2]);
              } else {
                // Format: MM:SS.mmm
                timeInSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
              }
            } else {
              timeInSeconds = parseFloat(timeCode);
            }

            matches.push({ time: timeInSeconds, text: text });
          }

          // Process each word with its timestamp
          for (let j = 0; j < matches.length; j++) {
            // Only add non-empty text
            if (matches[j].text) {
              lineData.push({
                text: matches[j].text,
                from: matches[j].time,
                to: j < matches.length - 1 ? matches[j + 1].time : cue.endTime,
              });
            }
          }

          // Handle the case where the line starts with text before any timestamp
          const firstTimestampPos = line.indexOf("<");
          if (firstTimestampPos > 0) {
            const initialText = line.substring(0, firstTimestampPos).trim();
            if (initialText) {
              lineData.unshift({
                text: initialText,
                from: cue.startTime,
                to: matches.length > 0 ? matches[0].time : cue.endTime,
              });
            }
          }
        } else {
          // Regular line without timestamps
          lineData.push({
            text: line.trim(),
            from: cue.startTime,
            to: cue.endTime,
          });
        }

        // Only add the line if it has content
        if (lineData.length > 0) {
          result.push(lineData);
        }
      }
    }

    window.setVideoSubtitle(result);
    return;
  }

  window.setVideoSubtitle([]);
}

// Function to exit video playback
export function exitVideo() {
  const videoContainer = document.getElementById("video-container");
  const videoPlayer = document.getElementById("video-player");
  const audioPlayer = document.getElementById("audio-player");

  // Stop video and audio if they exist
  if (videoPlayer) videoPlayer.pause();
  if (audioPlayer) audioPlayer.pause();

  // Remove the event listener using the stored reference
  if (videoContainer.escapeHandler) {
    document.removeEventListener("keydown", videoContainer.escapeHandler, true);
    videoContainer.escapeHandler = null;
  }

  // Clear any subtitle event listeners
  if (videoPlayer) {
    videoPlayer.removeEventListener("timeupdate", updateCustomSubtitles);
  }

  // Clear the video container
  videoContainer.classList.remove("fullscreen-video");
  videoContainer.innerHTML = "";

  // Update URL to remove video
  updateMenuPath();

  renderState();

  // Request texture update
  if (window.requestTextureUpdate) {
    window.requestTextureUpdate();
  }
}
