// Set up WebGL shader for VHS effect
const canvas = document.getElementById("vhs-effect");
const captureCanvas = document.getElementById("canvas");
const captureContext = captureCanvas.getContext("2d");

const gl = initializeWebGL(canvas);

let texture;
let needsTextureUpdate = true;
let subtitleSystem;

export function setupVHSShader() {
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  texture = createTexture(gl);

  subtitleSystem = setupSubtitleSystem(captureCanvas, captureContext);

  setupCanvasResize(canvas, gl, captureCanvas, subtitleSystem);

  const program = createShaderProgram(gl);

  const renderLoop = setupRenderLoop(
    gl,
    canvas,
    program,
    texture,
    captureCanvas,
    captureContext,
    subtitleSystem,
  );

  exposePublicAPI();

  renderLoop();
}

function initializeWebGL(canvas) {
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    console.error("WebGL not supported");
    return null;
  }
  return gl;
}

function setupCanvasResize(canvas, gl) {
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);

    if (window.requestTextureUpdate) {
      window.requestTextureUpdate();
    }
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
}

function createShaderProgram(gl) {
  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    fragmentShaderSource,
    gl.FRAGMENT_SHADER,
  );

  return createAndLinkProgram(gl, vertexShader, fragmentShader);
}

function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createAndLinkProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return;
  }

  // Create buffer for fullscreen quad
  const vertices = new Float32Array([
    -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
  ]);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  texture = createTexture(gl);

  const positionLocation = gl.getAttribLocation(program, "position");

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  return program;
}

function createTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return texture;
}

function setupRenderLoop(
  gl,
  canvas,
  program,
  texture,
  captureCanvas,
  captureContext,
  subtitleSystem,
) {
  let animationFrame;
  let startTime = Date.now();

  const resolutionLocation = gl.getUniformLocation(program, "iResolution");
  const timeLocation = gl.getUniformLocation(program, "iTime");
  const channelLocation = gl.getUniformLocation(program, "iChannel0");

  function render() {
    const videoPlayer = document.getElementById("video-player");
    if (videoPlayer) {
      if (videoPlayer.paused && !needsTextureUpdate) {
        // If the video is paused, skip rendering
        animationFrame = requestAnimationFrame(render);
        return;
      }

      // For video playback, directly capture the video element
      captureContext.setTransform(1, 0, 0, 1, 0, 0); // Reset transformations
      captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
      captureContext.drawImage(
        videoPlayer,
        0,
        0,
        captureCanvas.width,
        captureCanvas.height,
      );

      subtitleSystem.renderSubtitle(videoPlayer);
    }

    if (!videoPlayer && !needsTextureUpdate) {
      // If no video player and no texture update needed, skip rendering
      animationFrame = requestAnimationFrame(render);
      return;
    }

    if (!document.body.classList.contains("shader-enabled")) {
      canvas.style.display = "none";
      animationFrame = requestAnimationFrame(render);
      return;
    }

    canvas.style.display = "block";

    const time = (Date.now() - startTime) / 1000;

    // Update WebGL texture with the canvas data
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      captureCanvas,
    );

    // Render the shader
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);
    gl.uniform1i(channelLocation, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    needsTextureUpdate = false; // Reset the flag after updating

    animationFrame = requestAnimationFrame(render);
  }

  return render;
}

function setupSubtitleSystem(canvas, context) {
  let currentSubtitle = null;
  let currentSubtitleChanged = false;
  // create temporary canvas for text rendering

  // Add a function to render text to the subtitle canvas
  function renderSubtitle(videoPlayer) {
    if (currentSubtitle && currentSubtitleChanged) {
      currentSubtitleChanged = false;
    }

    if (!currentSubtitle) {
      return;
    }

    // todo: scale based on max line width
    let fontSize = Math.min(
      (2.75 * window.innerWidth) / 100,
      (8 * window.innerHeight) / 100,
    );

    // Draw subtitle text
    context.font = `${fontSize}px 'Home Video', 'Courier New', monospace`;
    context.textAlign = "left";
    context.textBaseline = "bottom";

    context.lineJoin = "round";
    context.strokeStyle = "black";
    context.lineWidth = 3;

    context.fillStyle = "white";

    for (let i = 0; i < currentSubtitle.length; i++) {
      const line = currentSubtitle[i];
      let text = [];
      for (let j = 0; j < line.length; j++) {
        const word = line[j];
        text.push(word.text);
      }
      text = text.join(" ").trim();

      // measure the text width
      const textWidth = context.measureText(text).width;

      // if currentSubtitle has multiple lines, shift line above
      const yOffset = (i - (currentSubtitle.length - 1) / 2) * fontSize * 1.2;
      let x = canvas.width / 2 - textWidth / 2;

      // draw each word one by one
      for (let j = 0; j < line.length; j++) {
        let y = canvas.height - fontSize + yOffset;
        const word = line[j];
        const spaceWidth = context.measureText(" ").width;
        const wordWidth = context.measureText(word.text).width;

        if (videoPlayer.currentTime >= word.from) {
          context.fillStyle = "#f1a900";
        } else {
          context.fillStyle = "white";
        }

        context.strokeText(word.text, x, y);
        context.fillText(word.text, x, y);

        // if word is active, draw a gradient
        if (
          videoPlayer.currentTime >= word.from &&
          videoPlayer.currentTime < word.to
        ) {
          let progress =
            (videoPlayer.currentTime - word.from) / (word.to - word.from);

          context.fillStyle = "white";
          context.fillText(word.text, x, y);

          context.save();

          context.beginPath();
          context.rect(x, y - fontSize, wordWidth * progress, fontSize);
          context.clip();
          context.fillStyle = "#f1a900";
          context.fillText(word.text, x, y);

          context.restore();

          context.fillStyle = "white"; // Reset fillStyle after gradient
        }

        x += wordWidth + spaceWidth;
      }
    }
  }

  return {
    renderSubtitle,
    setVideoSubtitle: (text) => {
      currentSubtitle = text;
      currentSubtitleChanged = true;
    },
    clearVideoSubtitle: () => {
      currentSubtitle = null;
      currentSubtitleChanged = true;
    },
  };
}

function exposePublicAPI() {
  // Add a new toggle function for the shader
  window.toggleVHSShader = function (enabled) {
    if (enabled) {
      document.body.classList.add("shader-enabled");
      // Force immediate texture update when enabling shaders
      setTimeout(() => {
        if (window.requestTextureUpdate) {
          updateTexture(true); // Pass true to force immediate capture
        }
      }, 25); // Small delay to ensure DOM classes are applied
    } else {
      document.body.classList.remove("shader-enabled");
    }

    // Request texture update after toggling shaders
    if (window.requestTextureUpdate) {
      window.requestTextureUpdate();
    }
  };

  window.requestTextureUpdate = function (immediate = false) {
    if (needsTextureUpdate) return; // Avoid multiple requests
    needsTextureUpdate = true;
    updateTexture(immediate);
  };

  window.setVideoSubtitle = subtitleSystem.setVideoSubtitle;
  window.clearVideoSubtitle = subtitleSystem.clearVideoSubtitle;
}

// Create shaders
const vertexShaderSource = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;
uniform sampler2D subtitleChannel;

void main() {
  float warp = 0.25; // simulate curvature of CRT monitor
  float scan = 0.50; // simulate darkness between scanlines
  float cornerRadius = 0.03; // controls how rounded the corners appear
  float padding = 0.015; // add padding around the screen

  vec2 fragCoord = vUv * iResolution;
  vec2 uv = fragCoord / iResolution.xy;

  // apply padding
  if (uv.x < padding || uv.x > 1.0 - padding || uv.y < padding || uv.y > 1.0 - padding) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black padding
    return;
  }

  // adjust UV coordinates to account for padding
  uv = (uv - vec2(padding)) / (1.0 - 2.0 * padding);

  vec2 dc = abs(0.5 - uv);
  dc *= dc;

  vec2 warpedUV = uv;
  warpedUV.x -= 0.5; warpedUV.x *= 1.0 + (dc.y * (0.3 * warp)); warpedUV.x += 0.5;
  warpedUV.y -= 0.5; warpedUV.y *= 1.0 + (dc.x * (0.4 * warp)); warpedUV.y += 0.5;

  // calculate the warped Y position for scanlines
  float warpedY = warpedUV.y * iResolution.y;

  // determine if we are drawing in a scanline using the warped position
  float apply = abs(sin(warpedY) * 0.25 * scan);

  // sample the texture
  vec3 color = texture2D(iChannel0, warpedUV).rgb;

  // sample the subtitle texture
  vec4 subtitleColor = texture2D(subtitleChannel, warpedUV);

  // blend the subtitle color with the main color
  color = mix(color, subtitleColor.rgb, subtitleColor.a);

  // calculate distance from corner for rounded effect
  vec2 fromCenter = abs(warpedUV - 0.5) * 2.0;
  float cornerDistance = length(max(fromCenter - vec2(1.0 - cornerRadius), 0.0)) / cornerRadius;

  // for areas outside the curved screen or beyond corner radius, make them black
  if(warpedUV.x < 0.0 || warpedUV.x > 1.0 || warpedUV.y < 0.0 || warpedUV.y > 1.0 || cornerDistance > 1.0) {
      color = vec3(0.0);
      apply = 0.0;
  }

  // mix the sampled color with the scanline intensity
  vec3 finalColor = mix(color, vec3(0.0), apply);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function captureCanvasContent() {
  const videoPlayer = document.getElementById("video-player");
  if (videoPlayer) {
    captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
    captureContext.drawImage(
      videoPlayer,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );

    subtitleSystem.renderSubtitle(videoPlayer);
  }

  // Update WebGL texture with the canvas data
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    captureCanvas,
  );

  // Reset the flag after updating
  needsTextureUpdate = false;
}

function updateTexture(immediate = false) {
  if (!document.body.classList.contains("shader-enabled")) {
    return;
  }

  if (immediate) {
    // For immediate captures (initial load or critical updates)
    captureCanvasContent();
  } else {
    // For regular updates, use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(captureCanvasContent);
  }
}
