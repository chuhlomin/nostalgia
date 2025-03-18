// UI-specific helper functions
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

    // Format the subtitle text
    let formattedText = cue.text
      .split("\n")
      .map((line) => `<span>${line}</span>`)
      .join("<br>");

    container.innerHTML = formattedText;
    container.style.display = "block";
  } else {
    container.innerHTML = "";
    container.style.display = "none";
  }
}
