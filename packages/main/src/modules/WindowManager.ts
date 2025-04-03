import type { AppModule } from "../AppModule.js";
import { ModuleContext } from "../ModuleContext.js";
import { BrowserWindow } from "electron";
import type { AppInitConfig } from "../AppInitConfig.js";
import { protocol } from "electron";
import fs from "fs";
import fsp from "fs/promises"; // Use promise-based fs for async/await
import path from "path";
import { URL, fileURLToPath } from "url";
import { Readable } from "stream"; // To convert Node stream to Web stream

protocol.registerSchemesAsPrivileged([
  {
    scheme: "vhs",
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true, // Good practice to add this
      standard: true, // Treat it like a standard URL scheme (helps parsing)
    },
  },
]);

// Helper function to parse Range header (safer version)
function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number,
): { start: number; end: number } | null {
  if (!rangeHeader) {
    return null;
  }
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) {
    console.warn(`[vhs handle] Invalid Range format: ${rangeHeader}`);
    return null;
  }

  const start = parseInt(match[1], 10);
  // If end is missing or empty, use the end of the file
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate range
  if (
    isNaN(start) ||
    isNaN(end) ||
    start < 0 ||
    start >= fileSize ||
    end < start ||
    end >= fileSize
  ) {
    console.warn(
      `[vhs handle] Invalid Range values: ${rangeHeader} for size ${fileSize}`,
    );
    return null; // Treat as invalid range
  }
  return { start, end };
}

class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools;

  constructor({
    initConfig,
    openDevTools = false,
  }: {
    initConfig: AppInitConfig;
    openDevTools?: boolean;
  }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();

    const registered = protocol.handle("vhs", async (request) => {
      const requestedUrl = request.url;

      try {
        let fileUrlString: string;
        if (requestedUrl.startsWith("vhs://")) {
          const pathPart = requestedUrl.substring("vhs://".length);
          // Ensure leading slash for absolute paths for URL constructor
          fileUrlString = `file://${pathPart.startsWith("/") ? "" : "/"}${pathPart}`;
        } else {
          console.error(`[vhs handle] Unexpected URL format: ${requestedUrl}`);
          return new Response("Invalid protocol scheme", { status: 400 });
        }

        const fileUrl = new URL(fileUrlString);
        const filePath = fileURLToPath(fileUrl);

        // Check file existence and get stats
        let stats: fs.Stats;
        try {
          stats = await fsp.stat(filePath);
          if (!stats.isFile()) {
            console.error(`[vhs handle] Path is not a file: ${filePath}`);
            return new Response("Path is not a file", { status: 400 });
          }
        } catch (err: any) {
          if (err.code === "ENOENT") {
            console.error(`[vhs handle] File not found: ${filePath}`, err);
            return new Response("File not found", { status: 404 });
          } else {
            console.error(
              `[vhs handle] Error accessing file stats: ${filePath}`,
              err,
            );
            return new Response("Internal Server Error (stat)", {
              status: 500,
            });
          }
        }
        const fileSize = stats.size;

        const fileExt = path.extname(filePath).toLowerCase();
        let mimeType = "video/mp4"; // Default
        switch (fileExt) {
          case ".mp4":
            mimeType = "video/mp4";
            break;
          case ".webm":
            mimeType = "video/webm";
            break;
          case ".ogg":
          case ".ogv":
            mimeType = "video/ogg";
            break;
          case ".mkv":
            mimeType = "video/x-matroska";
            break;
          case ".avi":
            mimeType = "video/x-msvideo";
            break;
          case ".mov":
            mimeType = "video/quicktime";
            break;
          default:
            mimeType = "application/octet-stream";
            console.warn(
              `[vhs handle] Unknown video extension "${fileExt}", using fallback MIME type.`,
            );
        }

        const range = parseRangeHeader(request.headers.get("range"), fileSize);
        if (range) {
          const { start, end } = range;
          const contentLength = end - start + 1;

          // Create a stream for the specific range
          const stream = fs.createReadStream(filePath, { start, end });

          // Convert Node stream to Web standard stream for better Response compatibility
          const webStream = Readable.toWeb(stream);

          return new Response(webStream as ReadableStream, {
            status: 206, // Partial Content
            headers: {
              "Content-Type": mimeType,
              "Content-Length": contentLength.toString(),
              "Content-Range": `bytes ${start}-${end}/${fileSize}`,
              "Accept-Ranges": "bytes",
            },
          });
        } else {
          // No range requested, send the whole file
          const stream = fs.createReadStream(filePath);
          const webStream = Readable.toWeb(stream);

          return new Response(webStream as ReadableStream, {
            status: 200, // OK
            headers: {
              "Content-Type": mimeType,
              "Content-Length": fileSize.toString(),
              "Accept-Ranges": "bytes", // Still indicate range support
            },
          });
        }
      } catch (error: any) {
        console.error(
          `[vhs handle] Unexpected error handling request ${request.url}:`,
          error,
        );
        return new Response("Internal Server Error", { status: 500 });
      }
    });
    // --- End of protocol.handle ---

    console.log(`[vhs protocol] Registered protocol: ${registered}`);

    await this.restoreOrCreateWindow(true);
    app.on("second-instance", () => this.restoreOrCreateWindow(true));
    app.on("activate", () => this.restoreOrCreateWindow(true));
  }

  async createWindow(): Promise<BrowserWindow> {
    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Needed to read files from the file system.
        preload: this.#preload.path,
      },
    });

    if (this.#renderer instanceof URL) {
      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }

    if (!show) {
      return window;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window?.show();

    if (this.#openDevTools) {
      window?.webContents.openDevTools();
    }

    window.focus();

    return window;
  }
}

export function createWindowManagerModule(
  ...args: ConstructorParameters<typeof WindowManager>
) {
  return new WindowManager(...args);
}
