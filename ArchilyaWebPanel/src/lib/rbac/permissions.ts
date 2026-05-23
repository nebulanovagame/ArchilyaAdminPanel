export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function hasMinimumRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export type Permission =
  | "workspace.delete"
  | "workspace.invite"
  | "workspace.removeMember"
  | "workspace.branding"
  | "workspace.billing"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.upload"
  | "aiStudio.use"
  | "settings.view"
  | "settings.update";

const PERMISSION_MATRIX: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "workspace.delete",
    "workspace.invite",
    "workspace.removeMember",
    "workspace.branding",
    "workspace.billing",
    "project.create",
    "project.update",
    "project.delete",
    "project.upload",
    "aiStudio.use",
    "settings.view",
    "settings.update",
  ],
  admin: [
    "workspace.invite",
    "workspace.removeMember",
    "workspace.branding",
    "workspace.billing",
    "project.create",
    "project.update",
    "project.delete",
    "project.upload",
    "aiStudio.use",
    "settings.view",
    "settings.update",
  ],
  editor: [
    "project.create",
    "project.update",
    "project.upload",
    "aiStudio.use",
    "settings.view",
  ],
  viewer: [
    "settings.view",
  ],
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role].includes(permission);
}
