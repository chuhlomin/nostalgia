// Set up WebGL shader for VHS effect
export function setupVHSShader() {
  // First create a container for our effect
  const effectContainer = document.createElement("div");
  effectContainer.style.position = "fixed";
  effectContainer.style.top = "0";
  effectContainer.style.left = "0";
  effectContainer.style.width = "100%";
  effectContainer.style.height = "100%";
  effectContainer.style.pointerEvents = "none";
  effectContainer.style.zIndex = "1000";
  effectContainer.id = "vhs-effect-container";
  document.body.appendChild(effectContainer);

  // Create canvas for the shader
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  effectContainer.appendChild(canvas);

  // Initialize WebGL
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  let captureCanvas;
  let subtitleCanvas;

  // Ensure canvas is fullscreen
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);

    // Update capture canvas dimensions too
    if (typeof captureCanvas !== "undefined") {
      captureCanvas.width = window.innerWidth;
      captureCanvas.height = window.innerHeight;
    }

    if (window.requestTextureUpdate) {
      window.requestTextureUpdate();
    }

    // Also resize subtitle canvas
    if (typeof subtitleCanvas !== "undefined") {
      subtitleCanvas.width = window.innerWidth;
      subtitleCanvas.height = window.innerHeight;

      // Re-render current subtitle after resize
      if (currentSubtitle) {
        renderSubtitle(currentSubtitle);
      }
    }
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

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
            float cornerRadius = 0.0125; // controls how rounded the corners appear

            vec2 fragCoord = vUv * iResolution;
            vec2 uv = fragCoord / iResolution.xy;
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

  // Compile shader program
  function compileShader(source, type) {
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

  const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    fragmentShaderSource,
    gl.FRAGMENT_SHADER,
  );

  // Create program
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

  // Create texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Create subtitle canvas and texture
  subtitleCanvas = document.createElement("canvas");
  subtitleCanvas.width = window.innerWidth;
  subtitleCanvas.height = window.innerHeight;
  const subtitleCtx = subtitleCanvas.getContext("2d");

  const subtitleTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, subtitleTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Bind attributes and uniforms
  const positionLocation = gl.getAttribLocation(program, "position");
  const resolutionLocation = gl.getUniformLocation(program, "iResolution");
  const timeLocation = gl.getUniformLocation(program, "iTime");
  const channelLocation = gl.getUniformLocation(program, "iChannel0");
  const subtitleChannelLocation = gl.getUniformLocation(
    program,
    "subtitleChannel",
  );

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Include html2canvas script
  function loadScript(url, callback) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
  }

  // We need to load html2canvas to capture the DOM as a texture
  loadScript(
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    setupRenderer,
  );

  let captureContext;
  let startTime = Date.now();
  let animationFrame;
  let needsTextureUpdate = true;

  function captureDOM() {
    html2canvas(document.getElementById("container"), {
      backgroundColor: null,
      logging: false,
      scale: 1,
      width: window.innerWidth,
      height: window.innerHeight,
      useCORS: true,
      allowTaint: true,
      // Reduce rendering quality slightly for better performance
      imageTimeout: 0,
    }).then((canvas) => {
      // Draw the captured content on our captureCanvas
      captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
      captureContext.drawImage(canvas, 0, 0);

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
    });
  }

  function updateTexture(immediate = false) {
    if (!document.body.classList.contains("shader-enabled")) {
      return;
    }

    if (immediate) {
      // For immediate captures (initial load or critical updates)
      captureDOM();
    } else {
      // For regular updates, use requestAnimationFrame to avoid blocking UI
      requestAnimationFrame(captureDOM);
    }
  }

  function setupRenderer() {
    // Create a canvas for capturing the DOM
    captureCanvas = document.createElement("canvas");
    captureCanvas.width = window.innerWidth;
    captureCanvas.height = window.innerHeight;
    captureContext = captureCanvas.getContext("2d");

    // Immediately capture the initial state
    updateTexture(true);

    // Start the render loop
    render();
  }

  function updateTexture() {
    if (!document.body.classList.contains("shader-enabled")) {
      return;
    }

    // Use html2canvas to capture the DOM
    html2canvas(document.getElementById("container"), {
      backgroundColor: null,
      logging: false,
      scale: 1,
      width: window.innerWidth,
      height: window.innerHeight,
    }).then((canvas) => {
      // Draw the captured content on our captureCanvas
      captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
      captureContext.drawImage(canvas, 0, 0);

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
    });
  }

  function render() {
    const time = (Date.now() - startTime) / 1000;

    if (!document.body.classList.contains("shader-enabled")) {
      effectContainer.style.display = "none";
      animationFrame = requestAnimationFrame(render);
      return;
    }

    effectContainer.style.display = "block";

    // Check if video is playing and optimize video texture update
    const videoContainer = document.getElementById("video-container");
    const videoPlayer = document.getElementById("video-player");

    if (
      videoContainer.classList.contains("fullscreen-video") &&
      videoPlayer &&
      !videoPlayer.paused
    ) {
      // For video playback, directly capture the video element
      // instead of using html2canvas for better performance
      if (captureContext && captureCanvas) {
        captureContext.clearRect(
          0,
          0,
          captureCanvas.width,
          captureCanvas.height,
        );
        captureContext.drawImage(
          videoPlayer,
          0,
          0,
          captureCanvas.width,
          captureCanvas.height,
        );

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
      }
    } else if (needsTextureUpdate) {
      // Don't block the rendering on texture updates
      // The texture will update asynchronously when needed
      // Only use html2canvas for static UI content
      // updateTexture();
      // needsTextureUpdate = false;
    }

    // Render the shader
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update subtitle texture if needed
    if (currentSubtitle && currentSubtitleChanged) {
      renderSubtitle(currentSubtitle);
      currentSubtitleChanged = false;
    }

    // Bind both textures when rendering
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, subtitleTexture);

    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);
    gl.uniform1i(channelLocation, 0);
    gl.uniform1i(subtitleChannelLocation, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationFrame = requestAnimationFrame(render);
  }

  // Add a function to render text to the subtitle canvas
  let currentSubtitle = null;
  let currentSubtitleChanged = false;

  function renderSubtitle(text) {
    // Clear the subtitle canvas
    subtitleCtx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);

    if (!text) {
      // If no subtitle, update texture with empty canvas
      gl.bindTexture(gl.TEXTURE_2D, subtitleTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        subtitleCanvas,
      );
      return;
    }

    // font-size: max(2vw, 5vh)
    let fontSize = Math.max(
      (2 * window.innerWidth) / 100,
      (5 * window.innerHeight) / 100,
    );

    // Draw subtitle text
    subtitleCtx.font = `bold ${fontSize}px 'HomeVideo'`;
    subtitleCtx.textAlign = "center";
    subtitleCtx.textBaseline = "bottom";

    // Text outline for better visibility
    subtitleCtx.strokeStyle = "black";
    subtitleCtx.lineWidth = 3;
    subtitleCtx.strokeText(
      text,
      subtitleCanvas.width / 2,
      subtitleCanvas.height - fontSize,
    );

    // Text fill
    subtitleCtx.fillStyle = "white";
    subtitleCtx.fillText(
      text,
      subtitleCanvas.width / 2,
      subtitleCanvas.height - fontSize,
    );

    const gradient = subtitleCtx.createLinearGradient(
      canvas.width / 2 - 5,
      0,
      canvas.width / 2 + 5,
      0,
    );
    gradient.addColorStop(0, "red");
    gradient.addColorStop(1, "blue");
    subtitleCtx.fillStyle = gradient;
    subtitleCtx.fillText(
      text,
      subtitleCanvas.width / 2,
      subtitleCanvas.height - fontSize,
    );

    // Update WebGL texture with subtitle canvas
    gl.bindTexture(gl.TEXTURE_2D, subtitleTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      subtitleCanvas,
    );
  }

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

  // Expose the function to request texture updates
  window.requestTextureUpdate = function (immediate = false) {
    if (needsTextureUpdate) return; // Avoid multiple requests
    needsTextureUpdate = true;
    updateTexture(immediate);
  };

  // Cleanup function
  window.cleanupVHSShader = function () {
    window.removeEventListener("resize", resizeCanvas);
    cancelAnimationFrame(animationFrame);
    if (effectContainer && effectContainer.parentNode) {
      effectContainer.parentNode.removeChild(effectContainer);
    }
  };

  // Expose subtitle API
  window.setVideoSubtitle = function (text) {
    currentSubtitle = text;
    currentSubtitleChanged = true;
  };

  window.clearVideoSubtitle = function () {
    currentSubtitle = null;
    currentSubtitleChanged = true;
  };
}
