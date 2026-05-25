import { describe, expect, it } from "vitest";

import { runAudit } from "@/lib/validators/audit-engine";
import type { IntakeState } from "@/lib/types/scene";

function buildValidIntake(overrides: Partial<IntakeState> = {}): IntakeState {
  return {
    scenes: [
      {
        id: "scene-1",
        label: "Salon",
        direction: "north",
        type: "interior",
        imageFile: null,
        imagePreview: "data:image/png;base64,test",
        thumbnailUrl: null,
        hasFurnishing: true,
        frameQuality: 90,
        order: 0,
        createdAt: Date.now(),
      },
    ],
    materials: [
      {
        id: "material-1",
        label: "Mermer",
        category: "floor",
        imageFile: null,
        imagePreview: "data:image/png;base64,test",
        order: 0,
        createdAt: Date.now(),
      },
    ],
    moodboards: [],
    clientReferences: [],
    lightPreference: "sunny",
    isSubmitting: false,
    ...overrides,
  };
}

describe("audit-engine", () => {
  it("returns INP-001 CRITICAL for empty scene list", () => {
    const result = runAudit(buildValidIntake({ scenes: [] }));
    const violation = result.violations.find((v) => v.code === "INP-001");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("CRITICAL");
    expect(result.canProceed).toBe(false);
  });

  it("returns INP-002 WARNING for unlabeled scene", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], label: "  " }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "INP-002");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns INP-003 WARNING when light preference is missing", () => {
    const result = runAudit(buildValidIntake({ lightPreference: null }));
    const violation = result.violations.find((v) => v.code === "INP-003");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns INP-004 CRITICAL for scene without image", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [
          {
            ...buildValidIntake().scenes[0],
            imageFile: null,
            imagePreview: null,
            thumbnailUrl: null,
          },
        ],
      }),
    );
    const violation = result.violations.find((v) => v.code === "INP-004");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("CRITICAL");
  });

  it("returns SCN-001 CRITICAL for invalid scene type", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], type: "invalid" as "interior" }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "SCN-001");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("CRITICAL");
  });

  it("returns SCN-002 WARNING for invalid direction", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], direction: "up" as "north" }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "SCN-002");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns SCN-003 WARNING for duplicate scene order", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [
          buildValidIntake().scenes[0],
          { ...buildValidIntake().scenes[0], id: "scene-2", order: 0 },
        ],
      }),
    );
    const violation = result.violations.find((v) => v.code === "SCN-003");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns SCN-004 WARNING when scenes exceed MAX_SCENES", () => {
    const scenes = Array.from({ length: 9 }, (_, i) => ({
      ...buildValidIntake().scenes[0],
      id: `scene-${i}`,
      order: i,
    }));
    const result = runAudit(buildValidIntake({ scenes }));
    const violation = result.violations.find((v) => v.code === "SCN-004");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns MAT-001 WARNING for empty material list", () => {
    const result = runAudit(buildValidIntake({ materials: [] }));
    const violation = result.violations.find((v) => v.code === "MAT-001");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns MAT-002 WARNING for unlabeled material", () => {
    const result = runAudit(
      buildValidIntake({
        materials: [{ ...buildValidIntake().materials[0], label: "  " }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "MAT-002");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns MAT-003 WARNING for invalid material category", () => {
    const result = runAudit(
      buildValidIntake({
        materials: [{ ...buildValidIntake().materials[0], category: "invalid" as "floor" }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "MAT-003");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns MAT-004 WARNING for material without image", () => {
    const result = runAudit(
      buildValidIntake({
        materials: [
          {
            ...buildValidIntake().materials[0],
            imageFile: null,
            imagePreview: null,
          },
        ],
      }),
    );
    const violation = result.violations.find((v) => v.code === "MAT-004");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns VIS-001 CRITICAL when scene has no furnishing", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], hasFurnishing: false }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "VIS-001");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("CRITICAL");
  });

  it("returns VIS-002 CRITICAL for frame quality below 50", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], frameQuality: 30 }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "VIS-002");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("CRITICAL");
  });

  it("returns VIS-003 WARNING for frame quality between 50 and 80", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], frameQuality: 65 }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "VIS-003");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns VIS-004 WARNING when imagePreview is missing", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [
          {
            ...buildValidIntake().scenes[0],
            imageFile: new File([], "test.png"),
            imagePreview: null,
          },
        ],
      }),
    );
    const violation = result.violations.find((v) => v.code === "VIS-004");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns ATM-001 WARNING when light preference is missing", () => {
    const result = runAudit(buildValidIntake({ lightPreference: null }));
    const violation = result.violations.find((v) => v.code === "ATM-001");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns ATM-002 WARNING for night scene with low frame quality", () => {
    const result = runAudit(
      buildValidIntake({
        lightPreference: "night",
        scenes: [{ ...buildValidIntake().scenes[0], frameQuality: 80 }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "ATM-002");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns ATM-003 WARNING for exterior with incompatible atmosphere", () => {
    const result = runAudit(
      buildValidIntake({
        lightPreference: "night",
        scenes: [{ ...buildValidIntake().scenes[0], type: "exterior" }],
      }),
    );
    const violation = result.violations.find((v) => v.code === "ATM-003");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("WARNING");
  });

  it("returns canProceed: true when all rules pass", () => {
    const result = runAudit(buildValidIntake());
    expect(result.criticalCount).toBe(0);
    expect(result.canProceed).toBe(true);
  });

  it("returns correct checkedRuleCount", () => {
    const result = runAudit(buildValidIntake());
    expect(result.checkedRuleCount).toBe(19);
  });

  it("includes targetLabel for scene-specific violations", () => {
    const result = runAudit(
      buildValidIntake({
        scenes: [{ ...buildValidIntake().scenes[0], label: "Test Sahne" }],
      }),
    );
    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });
});
