import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPromptBridge(geminiApiKey = "") {
  vi.resetModules();
  vi.stubEnv("GEMINI_API_KEY", geminiApiKey);
  return import("./prompt-bridge");
}

describe("isLikelyEnglish", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("detects long English architectural prompts", async () => {
    const { isLikelyEnglish } = await loadPromptBridge();
    expect(isLikelyEnglish("Modern living room with a blue sofa and warm lighting, floor-to-ceiling windows, natural oak flooring, soft linen curtains, photorealistic architectural visualization, balanced composition, and realistic evening shadows.")).toBe(true);
  });

  it("does not classify prompts with Turkish characters as English", async () => {
    const { isLikelyEnglish } = await loadPromptBridge();
    expect(isLikelyEnglish("koltuğu mavi yap ve sıcak ışık ekle")).toBe(false);
  });

  it("does not classify ASCII Turkish prompts as English", async () => {
    const { isLikelyEnglish } = await loadPromptBridge();
    expect(isLikelyEnglish("koltugu mavi yap ve sicak isik ekle")).toBe(false);
  });
});

describe("translateToEnglish", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns original prompt when Gemini key is not configured", async () => {
    const { translateToEnglish } = await loadPromptBridge();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const prompt = "koltuğu mavi yap";

    await expect(translateToEnglish(prompt)).resolves.toBe(prompt);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns long English prompts without calling Gemini even when key is configured", async () => {
    const { translateToEnglish } = await loadPromptBridge("test-gemini-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const prompt = "Modern living room with a blue sofa and warm lighting, floor-to-ceiling windows, natural oak flooring, soft linen curtains, photorealistic architectural visualization, balanced composition, and realistic evening shadows.";

    await expect(translateToEnglish(prompt)).resolves.toBe(prompt);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls Gemini for Turkish prompts when key is configured", async () => {
    const { translateToEnglish } = await loadPromptBridge("test-gemini-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: "Make the sofa blue and add warm lighting" }] },
          },
        ],
      }),
    } as Response);

    await expect(translateToEnglish("koltuğu mavi yap ve sıcak ışık ekle")).resolves.toBe("Make the sofa blue and add warm lighting");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
