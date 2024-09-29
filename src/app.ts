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
const PASSWORD = Deno.env.get("PROTECTED_PAGE_PASSWORD") || "default_test_password";
if (PASSWORD === "default_test_password") {
    log.warning("Using default test password. Set PROTECTED_PAGE_PASSWORD for production.");
} else {
    log.info("Using password from PROTECTED_PAGE_PASSWORD environment variable.");
}

function generateLoginPage(error = "") {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Required - Agile Software Development</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .masthead {
            height: 100vh;
            min-height: 500px;
            background-image: url('assets/img/harvard-campus-somesh-kesarla-suresh-hWqrI3CyPuM-unsplash.jpg');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
    </style>
</head>
<body>
    <header class="masthead">
        <div class="container h-100">
            <div class="row h-100 align-items-center justify-content-center">
                <div class="col-12 col-md-8 col-lg-6">
                    <div class="card">
                        <div class="card-body">
                            <h2 class="card-title text-center mb-4">Password Required</h2>
                            ${error ? `<div class="alert alert-danger">${error}</div>` : ''}
                            <form method="POST">
                                <div class="mb-3">
                                    <label for="password" class="form-label">Enter Password</label>
                                    <input type="password" class="form-control" id="password" name="password" required>
                                </div>
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">Submit</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <footer class="bg-light py-3 mt-auto">
        <div class="container text-center">
            <img src="assets/img/cc-by-sa-88x31.png" alt="CC-BY-SA">
            <p class="mb-0">Agile Software Development by <a href="https://kasperowski.com/">Richard Kasperowski</a> is licensed under a <a href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International License</a>.</p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
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
