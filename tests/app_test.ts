import { assert, assertEquals, assertExists } from "https://deno.land/std@0.204.0/testing/asserts.ts";
import { assertSpyCall, Spy, spy } from "https://deno.land/std@0.204.0/testing/mock.ts";
import { join } from "https://deno.land/std@0.204.0/path/mod.ts";
import { createHandler, ServeFileWrapper } from "../src/app.ts";

const MOCK_PUBLIC_DIR = "/mock/app/public";

function createMockServeFileWrapper(responseBody: string, status = 200, headers = {}): ServeFileWrapper {
    // deno-lint-ignore no-unused-vars
    return async (path: string, req: Request): Promise<Response> => {
        console.log("mockServeFileWrapper called with path:", path);
        return new Response(responseBody, { status, headers });
    };
}

function createHandlerWithSpy(mockServeFileWrapper: ServeFileWrapper) {
    const spyServeFileWrapper = spy(mockServeFileWrapper) as Spy<ServeFileWrapper>;
    const handler = createHandler(spyServeFileWrapper, MOCK_PUBLIC_DIR);
    return { handler, spyServeFileWrapper };
}

function assertSpyCallWithPath(
    spyServeFileWrapper: Spy<ServeFileWrapper>,
    expectedPath: string,
    req: Request
) {
    assertSpyCall(spyServeFileWrapper, 0, {
        args: [join(MOCK_PUBLIC_DIR, expectedPath), req],
    });
    assert(spyServeFileWrapper.calls.length > 0, "Expected spyServeFileWrapper to be called");
    const returnedResponse = spyServeFileWrapper.calls[0].returned;
    assertExists(returnedResponse, "Returned response should not be undefined");
}

Deno.test("Unit test system works properly", () => {
    assertEquals(2 + 2, 4);
});

Deno.test("Request handler",async (t) => {
    await t.step("handler serves index.html for root path", async () => {
        const mockServeFileWrapper = createMockServeFileWrapper("Index Page");
        const {handler, spyServeFileWrapper} = createHandlerWithSpy(mockServeFileWrapper);

        const req = new Request("http://localhost:8000/");
        const response = await handler(req);

        assertEquals(response.status, 200, "Expected 200 status code");
        assertEquals(await response.text(), "Index Page");
        assertSpyCallWithPath(spyServeFileWrapper, "index.html", req);
    });

    await t.step("handler serves arbitrary file", async () => {
        const cssContent = "body { font-family: Arial, sans-serif; }";
        const mockServeFileWrapper = createMockServeFileWrapper(cssContent, 200, { "Content-Type": "text/css" });
        const { handler, spyServeFileWrapper } = createHandlerWithSpy(mockServeFileWrapper);

        const req = new Request("http://localhost:8000/styles/main.css");
        const response = await handler(req);

        assertEquals(response.status, 200);
        assertEquals(response.headers.get("Content-Type"), "text/css");
        assertEquals(await response.text(), cssContent);
        assertSpyCallWithPath(spyServeFileWrapper, "styles/main.css", req);
    });

    await t.step("handler returns 404 for non-existent file", async () => {
        const mockServeFileWrapper = createMockServeFileWrapper("404 Not Found", 404);
        const { handler, spyServeFileWrapper } = createHandlerWithSpy(mockServeFileWrapper);

        const req = new Request("http://localhost:8000/nonexistent.html");
        const response = await handler(req);

        assertEquals(response.status, 404);
        assertEquals(await response.text(), "404 Not Found");
        assertSpyCallWithPath(spyServeFileWrapper, "nonexistent.html", req);
    });
});
