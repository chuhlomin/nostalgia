import { updateMenuPath } from "./utils.js";

// Function to handle video playback
export function playVideo(videoPath, videoTitle, fromUrl = false) {
  const videoContainer = document.getElementById("video-container");

  // Create video and audio elements
  // const audioPath = videoPath.replace(".mp4", "_audio.mp4");
  const audioPath = videoPath.replace(".mp4", "_audio.mp4");
  const subtitlesPath = videoPath.replace(".mp4", ".vtt");

  videoContainer.innerHTML = `
    <div class="video-wrapper">
      <video id="video-player">
        <source src="${videoPath}" type="video/mp4">
        <track id="subtitles-track" kind="subtitles" src="${subtitlesPath}" srclang="ru" label="Russian" default>
        Your browser does not support the video tag.
      </video>
      <div id="custom-subtitles-container"></div>
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
  const customSubtitlesContainer = document.getElementById(
    "custom-subtitles-container",
  );

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
      updateCustomSubtitles(
        videoPlayer,
        subtitlesTrack,
        customSubtitlesContainer,
      );
    });

    // Also update on cuechange events
    subtitlesTrack.track.addEventListener("cuechange", () => {
      updateCustomSubtitles(
        videoPlayer,
        subtitlesTrack,
        customSubtitlesContainer,
      );
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
export function updateCustomSubtitles(videoPlayer, subtitlesTrack, container) {
  if (!subtitlesTrack || !subtitlesTrack.track || !container) return;

  const track = subtitlesTrack.track;

  // Check if track is loaded
  if (track.mode !== "showing") {
    track.mode = "showing";
  }

  // Get active cues
  if (track.activeCues && track.activeCues.length > 0) {
    const cue = track.activeCues[0];
    const currentTime = videoPlayer.currentTime;

    // Check if the text contains time codes in the format <00:00.000>
    if (cue.text.includes("<") && cue.text.includes(">")) {
      // Parse the text with time codes
      const lines = cue.text.split("\n");
      let formattedText = "";

      // Process each line separately to maintain line breaks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Process timestamped words in the line
        if (line.includes("<") && line.includes(">")) {
          // Extract all pairs of text and their timestamps
          const regex = /<(\d{2}:\d{2}\.\d{3})>/g;
          const timestamps = [];
          let match;

          // Find all timestamps in the line
          while ((match = regex.exec(line)) !== null) {
            const timeCode = match[1];
            const timePosition = match.index;

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

            timestamps.push({ position: timePosition, time: timeInSeconds });
          }

          // Split content by timestamps
          const parts = line.split(/<\d{2}:\d{2}\.\d{3}>/);
          let lineFormattedText = "";

          // Handle the first part (before any timestamp) - activate based on cue start time
          if (parts[0]) {
            const isFirstPartActive =
              i === 0
                ? currentTime >= cue.startTime
                : currentTime >= timestamps[0].time;
            lineFormattedText += isFirstPartActive
              ? `<span class="active-word">${parts[0]}</span>`
              : `<span>${parts[0]}</span>`;
          }

          // Process each part with its associated timestamp
          for (let j = 1; j < parts.length; j++) {
            const timestampIndex = j - 1;
            const isActive = currentTime >= timestamps[timestampIndex].time;

            if (isActive) {
              lineFormattedText += `<span class="active-word">${parts[j]}</span>`;
            } else {
              lineFormattedText += `<span>${parts[j]}</span>`;
            }
          }

          formattedText += lineFormattedText;
        } else {
          // Regular line without timestamps
          formattedText += `<span>${line}</span>`;
        }

        // Add a line break if this isn't the last line
        if (i < lines.length - 1) {
          formattedText += "<br> ";
        }
      }

      container.innerHTML = formattedText;
      window.setVideoSubtitle(
        formattedText
          .replace(/<br>/g, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " "),
      );
      return;
    }

    // Handle regular subtitles without time codes
    const isActive = currentTime >= cue.startTime;
    let formattedText = cue.text
      .split("\n")
      .map((line) =>
        isActive
          ? `<span class="active-word">${line}</span>`
          : `<span>${line}</span>`,
      )
      .join("<br> ");

    container.innerHTML = formattedText;
    window.setVideoSubtitle(
      formattedText
        .replace(/<br>/g, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " "),
    );
    container.style.display = "block";
    return;
  }

  container.innerHTML = "";
  container.style.display = "none";
  window.setVideoSubtitle("");
}

// Function to exit video playback
export function exitVideo() {
  const videoContainer = document.getElementById("video-container");
  const videoPlayer = document.getElementById("video-player");
  const audioPlayer = document.getElementById("audio-player");
  const customSubtitlesContainer = document.getElementById(
    "custom-subtitles-container",
  );

  // Stop video and audio if they exist
  if (videoPlayer) videoPlayer.pause();
  if (audioPlayer) audioPlayer.pause();

  // Remove the event listener using the stored reference
  if (videoContainer.escapeHandler) {
    document.removeEventListener("keydown", videoContainer.escapeHandler, true);
    videoContainer.escapeHandler = null;
  }

  // Clear any subtitle event listeners
  if (videoPlayer && customSubtitlesContainer) {
    videoPlayer.removeEventListener("timeupdate", updateCustomSubtitles);
  }

  // Clear the video container
  videoContainer.classList.remove("fullscreen-video");
  videoContainer.innerHTML = "";

  // Update URL to remove video
  updateMenuPath();

  // Request texture update
  if (window.requestTextureUpdate) {
    window.requestTextureUpdate();
  }
}
