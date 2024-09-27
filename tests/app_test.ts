import {assertEquals, assertExists} from "https://deno.land/std@0.204.0/testing/asserts.ts";
import { assertSpyCall, spy } from "https://deno.land/std@0.204.0/testing/mock.ts";
import { createHandler, ServeFileWrapper } from "../src/app.ts";

Deno.test("Unit test system works properly", () => {
    const result = 2 + 2;
    assertEquals(result, 4);
});

Deno.test("handler serves index.html for root path", async () => {
    // deno-lint-ignore no-unused-vars
    const mockServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
        assertEquals(path, "../public/index.html");
        return new Response("Index Page", { status: 200 });
    };

    const spyServeFileWrapper = spy(mockServeFileWrapper);

    const handler = createHandler(spyServeFileWrapper);

    const req = new Request("http://localhost:8000/");
    const response = await handler(req);

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "Index Page");

    assertSpyCall(spyServeFileWrapper, 0, {
        args: ["../public/index.html", req],
    });
    const returnedResponse = await spyServeFileWrapper.calls[0].returned;
    assertExists(returnedResponse, "Returned response should not be undefined");
});

Deno.test("handler serves arbitrary file", async () => {
    // deno-lint-ignore no-unused-vars
    const mockServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
        assertEquals(path, "../public/styles/main.css");
        return new Response("body { font-family: Arial, sans-serif; }", {
            status: 200,
            headers: { "Content-Type": "text/css" }
        });
    };

    const spyServeFileWrapper = spy(mockServeFileWrapper);

    const handler = createHandler(spyServeFileWrapper);

    const req = new Request("http://localhost:8000/styles/main.css");
    const response = await handler(req);

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Content-Type"), "text/css");
    assertEquals(await response.text(), "body { font-family: Arial, sans-serif; }");

    assertSpyCall(spyServeFileWrapper, 0, {
        args: ["../public/styles/main.css", req],
    });
    const returnedResponse = await spyServeFileWrapper.calls[0].returned;
    assertExists(returnedResponse, "Returned response should not be undefined");
});

Deno.test("handler returns 404 for non-existent file", async () => {
    // deno-lint-ignore no-unused-vars
    const mockServeFileWrapper: ServeFileWrapper = async (path: string, req: Request): Promise<Response> => {
        assertEquals(path, "../public/nonexistent.html");
        return new Response("404 Not Found", { status: 404 });
    };

    const spyServeFileWrapper = spy(mockServeFileWrapper);

    const handler = createHandler(spyServeFileWrapper);

    const req = new Request("http://localhost:8000/nonexistent.html");
    const response = await handler(req);

    assertEquals(response.status, 404);
    assertEquals(await response.text(), "404 Not Found");

    assertSpyCall(spyServeFileWrapper, 0, {
        args: ["../public/nonexistent.html", req],
    });
    const returnedResponse = await spyServeFileWrapper.calls[0].returned;
    assertExists(returnedResponse, "Returned response should not be undefined");
});
