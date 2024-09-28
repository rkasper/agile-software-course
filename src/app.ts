import { serveFile } from "https://deno.land/std@0.204.0/http/file_server.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.204.0/path/mod.ts";
import * as log from "https://deno.land/std@0.204.0/log/mod.ts";

log.setup({
  handlers: {
    console: new log.handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

const PROTECTED_PAGE = "/fall2024.html";
const PASSWORD = Deno.env.get("PROTECTED_PAGE_PASSWORD");
if (!PASSWORD) {
    log.error("PROTECTED_PAGE_PASSWORD environment variable is not set!");
    Deno.exit(1);
}

function generateLoginPage(error = "") {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Required</title>
    <style>
      body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
      form { background: #f0f0f0; padding: 20px; border-radius: 5px; }
      input { margin: 10px 0; padding: 5px; }
      .error { color: red; }
    </style>
  </head>
  <body>
    <form method="POST">
      <h2>Password Required</h2>
      ${error ? `<p class="error">${error}</p>` : ''}
      <input type="password" name="password" required>
      <input type="submit" value="Submit">
    </form>
  </body>
  </html>
  `;
}

function findPublicDir(): string {
    const possibleDirs = [
        join(Deno.cwd(), "public"),
        join(dirname(fromFileUrl(import.meta.url)), "..", "public"),
        "/app/public",
    ];

    for (const dir of possibleDirs) {
        try {
            const dirInfo = Deno.statSync(dir);
            if (dirInfo.isDirectory) {
                log.info(`Found public directory at: ${dir}`);
                return dir;
            }
        } catch {
            log.debug(`Directory not found or not accessible: ${dir}`);
        }
    }

    log.error("Could not find public directory");
    throw new Error("Could not find public directory");
}

const publicDir = findPublicDir();
log.info(`Using public directory: ${publicDir}`);

export type ServeFileWrapper = (path: string, req: Request) => Promise<Response>;

export const defaultServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
    try {
        return await serveFile(req, path);
    } catch (error) {
        log.error(`Error serving file ${path}: ${error.message}`);
        return new Response("404 Not Found", { status: 404 });
    }
};

export function createHandler(
    serveFileWrapperFn: ServeFileWrapper = defaultServeFileWrapper,
    injectedPublicDir?: string
) {
    const publicDir = injectedPublicDir || findPublicDir();
    log.info(`Handler created with public directory: ${publicDir}`);

    return async function handler(req: Request): Promise<Response> {
        const url = new URL(req.url);
        let filepath = decodeURIComponent(url.pathname);

        log.debug(`Handling request for: ${filepath}`);

        if (filepath === "" || filepath === "/") {
            filepath = "/index.html";
            log.debug('Serving index.html for root path');
        }

        if (filepath === "/do-test") {
            log.debug('Serving test response');
            return new Response("This filepath is totally working, my friend!");
        }

        if (filepath === PROTECTED_PAGE) {
            if (req.method === "POST") {
                const formData = await req.formData();
                const password = formData.get("password");
                if (password === PASSWORD) {
                    log.info(`Authorized access to ${PROTECTED_PAGE}`);
                    return serveFileWrapperFn(join(publicDir, filepath), req);
                } else {
                    log.info(`Unauthorized access attempt to ${PROTECTED_PAGE}`);
                    return new Response(generateLoginPage("Incorrect password. Please try again."), {
                        status: 401,
                        headers: { "Content-Type": "text/html" }
                    });
                }
            } else {
                return new Response(generateLoginPage(), {
                    status: 200,
                    headers: { "Content-Type": "text/html" }
                });
            }
        }

        try {
            const fullPath = join(publicDir, filepath);
            log.debug(`Attempting to serve file: ${fullPath}`);
            const response = await serveFileWrapperFn(fullPath, req);
            log.info(`Served ${filepath} with status ${response.status}`);
            return response;
        } catch (error) {
            log.error(`Error serving file ${filepath}: ${error.message}`);
            return new Response("404 Not Found", { status: 404 });
        }
    }
}

// Only start the server if this file is run directly
if (import.meta.main) {
    const handler = createHandler();
    Deno.serve({ port: 8000 }, handler);
}
