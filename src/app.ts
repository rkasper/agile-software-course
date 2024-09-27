import { serveFile } from "https://deno.land/std@0.204.0/http/file_server.ts";

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

async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    let filepath = decodeURIComponent(url.pathname);

    // If filepath is empty or /, serve index.html
    if (filepath === "" || filepath === "/") {
        filepath = "/index.html";
    }

    try {
        return await serveFile(req, `../public${filepath}`);
    } catch {
        return new Response("404 Not Found", { status: 404 });
    }
}

Deno.serve({ port: 8000 }, handler);
