import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { goClawClient } from "./goclaw-client";

describe("GoClawClient", () => {
  // The singleton has enabled=false because GOCLAW_GATEWAY_TOKEN is not set in test env

  describe("chat()", () => {
    it("returns null when disabled (no token)", async () => {
      const result = await goClawClient.chat("test prompt");
      expect(result).toBeNull();
    });

    it("logs warning when disabled", async () => {
      const spy = spyOn(console, "warn").mockImplementation(() => {});
      await goClawClient.chat("test");
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Disabled")
      );
      spy.mockRestore();
    });
  });

  describe("isAvailable()", () => {
    it("returns false when disabled (no token)", async () => {
      const result = await goClawClient.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe("chat() with enabled client", () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it("returns response content on success", async () => {
      // Temporarily enable the client
      (goClawClient as any).enabled = true;
      (goClawClient as any).baseUrl = "http://localhost:99999";

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "AI response here" } }],
          }),
          { status: 200 }
        )
      );

      const result = await goClawClient.chat("Hello AI");
      expect(result).toBe("AI response here");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Restore disabled state
      (goClawClient as any).enabled = false;
    });

    it("returns null on HTTP error", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );

      const errSpy = spyOn(console, "error").mockImplementation(() => {});
      const result = await goClawClient.chat("test");
      expect(result).toBeNull();
      errSpy.mockRestore();

      (goClawClient as any).enabled = false;
    });

    it("returns null on network error", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused")
      );

      const errSpy = spyOn(console, "error").mockImplementation(() => {});
      const result = await goClawClient.chat("test");
      expect(result).toBeNull();
      errSpy.mockRestore();

      (goClawClient as any).enabled = false;
    });

    it("returns null when response has no choices", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await goClawClient.chat("test");
      expect(result).toBeNull();

      (goClawClient as any).enabled = false;
    });
  });

  describe("isAvailable() with enabled client", () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it("returns true when server responds OK", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("OK", { status: 200 })
      );

      const result = await goClawClient.isAvailable();
      expect(result).toBe(true);

      (goClawClient as any).enabled = false;
    });

    it("returns false when server responds with error", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      const result = await goClawClient.isAvailable();
      expect(result).toBe(false);

      (goClawClient as any).enabled = false;
    });

    it("returns false on network error", async () => {
      (goClawClient as any).enabled = true;

      fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("ECONNREFUSED")
      );

      const result = await goClawClient.isAvailable();
      expect(result).toBe(false);

      (goClawClient as any).enabled = false;
    });
  });
});
