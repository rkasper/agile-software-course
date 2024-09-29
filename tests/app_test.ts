import {
    assert,
    assertEquals,
    assertExists,
    assertStringIncludes
} from "https://deno.land/std@0.204.0/testing/asserts.ts";
import { assertSpyCall, Spy, spy } from "https://deno.land/std@0.204.0/testing/mock.ts";
import { join } from "https://deno.land/std@0.204.0/path/mod.ts";
import { createHandler, PASSWORD, ServeFileWrapper } from "../src/app.ts";

const MOCK_PUBLIC_DIR = "/mock/app/public";

function createMockServeFileWrapper(responseBody: string, status = 200, headers = {}): ServeFileWrapper {
    // deno-lint-ignore require-await
    return async (path: string, _req: Request): Promise<Response> => {
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

    await t.step("handler serves login page for protected page without password", async () => {
        const mockServeFileWrapper = createMockServeFileWrapper("Protected content");
        const { handler, spyServeFileWrapper } = createHandlerWithSpy(mockServeFileWrapper);

        const req = new Request("http://localhost:8000/fall2024.html");
        const response = await handler(req);

        assertEquals(response.status, 200, "Expected 200 status code");
        const responseText = await response.text();
        assertStringIncludes(responseText, "<title>Password Required - Agile Software Development</title>");
        assertStringIncludes(responseText, "<h2 class=\"card-title text-center mb-4\">Password Required</h2>");
        assertStringIncludes(responseText, "<form method=\"POST\">");

        // Verify that the serveFileWrapper was not called
        assertEquals(spyServeFileWrapper.calls.length, 0, "serveFileWrapper should not be called for unauthenticated access");
    });

    await t.step("handler returns error for protected page with incorrect password", async () => {
        const mockServeFileWrapper = createMockServeFileWrapper("Protected content");
        const { handler, spyServeFileWrapper } = createHandlerWithSpy(mockServeFileWrapper);

        const formData = new FormData();
        formData.append("password", "incorrectpassword");

        const req = new Request("http://localhost:8000/fall2024.html", {
            method: "POST",
            body: formData
        });

        const response = await handler(req);

        assertEquals(response.status, 401, "Expected 401 Unauthorized status code");
        const responseText = await response.text();
        assertStringIncludes(responseText, "<title>Password Required - Agile Software Development</title>");
        assertStringIncludes(responseText, "<h2 class=\"card-title text-center mb-4\">Password Required</h2>");
        assertStringIncludes(responseText, "<div class=\"alert alert-danger\">Incorrect password. Please try again.</div>");
        assertStringIncludes(responseText, "<form method=\"POST\">");

        // Verify that the serveFileWrapper was not called
        assertEquals(spyServeFileWrapper.calls.length, 0, "serveFileWrapper should not be called for incorrect password");
    });

    await t.step("handler serves protected content with correct password", async () => {
        const protectedContent = "This is the protected content of fall2024.html";

       const mockServeFileWrapper = createMockServeFileWrapper(protectedContent);
        const { handler, spyServeFileWrapper } = createHandlerWithSpy(mockServeFileWrapper);

        const formData = new FormData();
        formData.append("password", PASSWORD);

        const req = new Request("http://localhost:8000/fall2024.html", {
            method: "POST",
            body: formData
        });

        const response = await handler(req);

        assertEquals(response.status, 200, "Expected 200 OK status code");
        const responseText = await response.text();
        assertEquals(responseText, protectedContent, "Protected content should be served");

        // Verify that the serveFileWrapper was called with the correct path
        assertSpyCall(spyServeFileWrapper, 0, {
            args: [join(MOCK_PUBLIC_DIR, "fall2024.html"), req],
        });
        assertEquals(spyServeFileWrapper.calls.length, 1, "serveFileWrapper should be called once for correct password");
    });
});
