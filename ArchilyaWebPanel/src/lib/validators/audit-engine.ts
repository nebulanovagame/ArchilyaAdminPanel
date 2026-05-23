import { AUDIT_RULES, AUDIT_RULE_COUNT } from "@/lib/constants/audit-rules";
import type { AuditReport, AuditRule, AuditViolation } from "@/lib/types/audit";
import {
  MATERIAL_CATEGORIES,
  MAX_SCENES,
  SCENE_DIRECTIONS,
  type IntakeState,
  type LightPreference,
  type MaterialCategory,
  type SceneDirection,
  type SceneType,
} from "@/lib/types/scene";

const validSceneTypes: readonly SceneType[] = ["interior", "exterior"];
const validExteriorAtmospheres: readonly LightPreference[] = ["sunny", "cloudy", "golden-hour"];

function rule(code: string): AuditRule {
  const auditRule = AUDIT_RULES.find((item) => item.code === code);
  if (!auditRule) {
    throw new Error(`Audit rule not found: ${code}`);
  }
  return auditRule;
}

function hasSceneImage(scene: IntakeState["scenes"][number]) {
  return Boolean(scene.imageFile || scene.imagePreview || scene.thumbnailUrl);
}

function hasMaterialImage(material: IntakeState["materials"][number]) {
  return Boolean(material.imageFile || material.imagePreview);
}

function violation(code: string, targetLabel?: string): AuditViolation {
  return { ...rule(code), targetLabel };
}

export function runAudit(intakeState: IntakeState): AuditReport {
  const violations: AuditViolation[] = [];
  const sceneOrders = new Set<number>();

  if (intakeState.scenes.length === 0) {
    violations.push(violation("INP-001"));
  }

  if (!intakeState.lightPreference) {
    violations.push(violation("INP-003"));
    violations.push(violation("ATM-001"));
  }

  if (intakeState.scenes.length > MAX_SCENES) {
    violations.push(violation("SCN-004"));
  }

  intakeState.scenes.forEach((scene, index) => {
    const targetLabel = scene.label.trim() || `Sahne ${index + 1}`;

    if (!scene.label.trim()) {
      violations.push(violation("INP-002", targetLabel));
    }

    if (!hasSceneImage(scene)) {
      violations.push(violation("INP-004", targetLabel));
    } else if (!scene.imagePreview) {
      violations.push(violation("VIS-004", targetLabel));
    }

    if (!validSceneTypes.includes(scene.type)) {
      violations.push(violation("SCN-001", targetLabel));
    }

    if (!SCENE_DIRECTIONS.some((direction) => direction.value === scene.direction)) {
      violations.push(violation("SCN-002", targetLabel));
    }

    if (sceneOrders.has(scene.order)) {
      violations.push(violation("SCN-003", targetLabel));
    }
    sceneOrders.add(scene.order);

    if (!scene.hasFurnishing) {
      violations.push(violation("VIS-001", targetLabel));
    }

    if (scene.frameQuality < 50) {
      violations.push(violation("VIS-002", targetLabel));
    } else if (scene.frameQuality < 80) {
      violations.push(violation("VIS-003", targetLabel));
    }

    if (intakeState.lightPreference === "night" && scene.frameQuality < 85) {
      violations.push(violation("ATM-002", targetLabel));
    }

    if (
      scene.type === "exterior" &&
      intakeState.lightPreference &&
      !validExteriorAtmospheres.includes(intakeState.lightPreference)
    ) {
      violations.push(violation("ATM-003", targetLabel));
    }
  });

  if (intakeState.materials.length === 0) {
    violations.push(violation("MAT-001"));
  }

  intakeState.materials.forEach((material, index) => {
    const targetLabel = material.label.trim() || `Malzeme ${index + 1}`;

    if (!material.label.trim()) {
      violations.push(violation("MAT-002", targetLabel));
    }

    if (!MATERIAL_CATEGORIES.some((category) => category.value === material.category)) {
      violations.push(violation("MAT-003", targetLabel));
    }

    if (!hasMaterialImage(material)) {
      violations.push(violation("MAT-004", targetLabel));
    }
  });

  const criticalCount = violations.filter((item) => item.severity === "CRITICAL").length;
  const warningCount = violations.filter((item) => item.severity === "WARNING").length;

  return {
    violations,
    criticalCount,
    warningCount,
    canProceed: criticalCount === 0,
    checkedRuleCount: AUDIT_RULE_COUNT,
    createdAt: Date.now(),
  };
}

export function isSceneDirection(value: string): value is SceneDirection {
  return SCENE_DIRECTIONS.some((direction) => direction.value === value);
}

export function isMaterialCategory(value: string): value is MaterialCategory {
  return MATERIAL_CATEGORIES.some((category) => category.value === value);
}
