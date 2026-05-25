import { describe, expect, it } from "vitest";
import trMessages from "../../../../messages/tr.json";
import enMessages from "../../../../messages/en.json";

const REQUIRED_KEYS = [
  "title",
  "eyebrow",
  "intakeSubtitle",
  "scenesTitle",
  "scenesSubtitle",
  "materialsSectionTitle",
  "lightAtmosphereTitle",
  "moodboardsSectionTitle",
  "submitToAuditor",
  "light.sunny",
  "light.cloudy",
  "light.sunset",
  "light.night",
  "light.overcast",
  "light.goldenHour",
  "dropzoneTitle",
  "dropzoneSubtitle",
  "browseFiles",
  "dropHere",
  "uploadSuccess",
  "scenesUploaded",
  "maxScenesReached",
  "interior",
  "exterior",
  "sceneLabelPlaceholder",
  "removeScene",
  "direction",
  "materialsTitle",
  "addMaterials",
  "materialLabelPlaceholder",
  "materialsAdded",
  "moodboardsTitle",
  "clientReferencesTitle",
  "directions.north",
  "directions.south",
  "directions.east",
  "directions.west",
  "directions.northEast",
  "directions.northWest",
  "directions.southEast",
  "directions.southWest",
  "categories.floor",
  "categories.wall",
  "categories.ceiling",
  "categories.object",
  "errors.invalidFormat",
  "errors.fileTooLarge",
  "errors.maxScenesReached",
  "errors.maxMaterialsReached",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedValue(obj: unknown, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((acc, key) => {
    if (isRecord(acc)) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

function getArchilyaRender(messages: unknown): unknown {
  if (isRecord(messages) && isRecord(messages.dashboard)) {
    return messages.dashboard.archilyaRender;
  }
  return undefined;
}

function expectRequiredKeys(messages: unknown, locale: string) {
  const archilyaRender = getArchilyaRender(messages);

  for (const key of REQUIRED_KEYS) {
    const value = getNestedValue(archilyaRender, key);

    expect(value, `${locale}: missing key "${key}"`).toBeDefined();
    expect(typeof value, `${locale}: key "${key}" must be a string`).toBe("string");
    expect((value as string).trim(), `${locale}: key "${key}" must not be empty`).not.toBe("");
  }
}

describe("dashboard.archilyaRender i18n keys", () => {
  it("has all required keys in Turkish and English", () => {
    expectRequiredKeys(trMessages, "tr");
    expectRequiredKeys(enMessages, "en");
  });
});
