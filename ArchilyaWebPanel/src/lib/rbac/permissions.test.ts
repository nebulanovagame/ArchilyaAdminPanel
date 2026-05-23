import { describe, expect, it } from "vitest";

import {
  ROLE_HIERARCHY,
  hasMinimumRole,
  hasPermission,
} from "@/lib/rbac/permissions";

describe("permissions", () => {
  it("uses the expected role hierarchy ordering", () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.editor);
    expect(ROLE_HIERARCHY.editor).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it("checks minimum role access correctly", () => {
    expect(hasMinimumRole("owner", "admin")).toBe(true);
    expect(hasMinimumRole("viewer", "editor")).toBe(false);
    expect(hasMinimumRole("admin", "admin")).toBe(true);
  });

  it("checks permissions correctly", () => {
    expect(hasPermission("owner", "workspace.delete")).toBe(true);
    expect(hasPermission("admin", "workspace.delete")).toBe(false);
    expect(hasPermission("editor", "project.upload")).toBe(true);
    expect(hasPermission("viewer", "aiStudio.use")).toBe(false);
  });
});
