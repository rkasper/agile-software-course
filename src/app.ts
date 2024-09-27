// import { serveFile } from "https://deno.land/std@0.204.0/http/file_server.ts";
//
// // Slightly complicated so we can mock createHandler() in unit tests
//
// export type ServeFileWrapper = (path: string, req: Request) => Promise<Response>;
//
// export const defaultServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
//     try {
//         return await serveFile(req, path);
//     } catch {
//         return new Response("404 Not Found", { status: 404 });
//     }
// };
//
// export function createHandler(serveFileWrapperFn: ServeFileWrapper = defaultServeFileWrapper) {
//     return async function handler(req: Request): Promise<Response> {
//         const url = new URL(req.url);
//         let filepath = decodeURIComponent(url.pathname);
//
//         if (filepath === "" || filepath === "/") {
//             filepath = "/index.html";
//         }
//
//         return await serveFileWrapperFn(`../public${filepath}`, req);
//     };
// }
//
// // Only start the server if this file is run directly
// if (import.meta.main) {
//     const handler = createHandler();
//     Deno.serve({ port: 8000 }, handler);
// }

import { serveFile } from "https://deno.land/std@0.204.0/http/file_server.ts";
import { join } from "https://deno.land/std@0.204.0/path/mod.ts";

const publicDir = join(Deno.cwd(), "../public");
console.log("Public directory:", publicDir);

async function handler(req: Request): Promise<Response> {
    console.log('handler: req.url == ', req.url);
    const url = new URL(req.url);
    let filepath = decodeURIComponent(url.pathname);

    // If filepath is empty or /, serve index.html
    if (filepath === "" || filepath === "/") {
        filepath = "/index.html";
    }

    // For testing on DO App Platform
    if (filepath === "/do-test") {
        return new Response("This filepath is totally working, my friend!");
    }

    try {
        const fullPath = join(publicDir, filepath);
        console.log('handler: attempting to serve ', fullPath);
        const fileInfo = await Deno.stat(fullPath);
        console.log('File exists:', fileInfo.isFile);
        return await serveFile(req, fullPath);
    } catch (error) {
        console.error('Error serving file:', error);
        return new Response("404 Not Found", { status: 404 });
    }
}

console.log("Starting server on port 8000");
Deno.serve({ port: 8000 }, handler);
