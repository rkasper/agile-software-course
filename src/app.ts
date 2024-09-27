import {serveFile} from "https://deno.land/std@0.204.0/http/file_server.ts";
import {dirname, fromFileUrl, join} from "https://deno.land/std@0.204.0/path/mod.ts";

// This is slightly complicated so we can mock createHandler() in unit tests.
// Was it worth the extra complexity? I'm still not sure.

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
                console.log("Found public directory at:", dir);
                return dir;
            }
        } catch {
            // Directory doesn't exist or is not accessible, continue to next
        }
    }

    throw new Error("Could not find public directory");
}

const publicDir = findPublicDir();
console.log("Public directory:", publicDir);

export type ServeFileWrapper = (path: string, req: Request) => Promise<Response>;

export const defaultServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
    try {
        return await serveFile(req, path);
    } catch {
        return new Response("404 Not Found", { status: 404 });
    }
};

export function createHandler(
    serveFileWrapperFn: ServeFileWrapper = defaultServeFileWrapper,
    injectedPublicDir?: string
) {
    const publicDir = injectedPublicDir || findPublicDir();
    console.log("Using public directory: ", publicDir);

    return async function handler(req: Request): Promise<Response> {
        const url = new URL(req.url);
        let filepath = decodeURIComponent(url.pathname);

        if (filepath === "" || filepath === "/") {
            filepath = "/index.html";
            console.log('handler: serving index.html');
        }

        if (filepath === "/do-test") {
            return new Response("This filepath is totally working, my friend!");
        }

        try {
            return await serveFileWrapperFn(join(publicDir, filepath), req);
        } catch (error) {
            console.error('Error serving file:', error);
            return new Response("404 Not Found", { status: 404 });
        }
    }
}

// Only start the server if this file is run directly
if (import.meta.main) {
    const handler = createHandler();
    Deno.serve({ port: 8000 }, handler);
}
