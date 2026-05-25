import { createClient } from "@/lib/supabase/client";

import {
  getDefaultFileCount,
  getFileTypeKey,
} from "./model";
import { mapProjectDocument } from "./mapper";
import type { CreateProjectInput, ProjectRecord } from "./types";

function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") {
    return "file";
  }

  let sanitized = name.normalize("NFKD");
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u2060\ufeff]/g, "");
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, "_");
  sanitized = sanitized.replace(/\s+/g, "-");
  sanitized = sanitized.replace(/\.{2,}/g, ".");
  sanitized = sanitized.replace(/^[.-]+/, "");
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
  sanitized = sanitized.replace(/[.\s]+$/, "");
  if (!sanitized) {
    return "file";
  }
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reserved.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
}

export async function addProjectActivityLog(
  _db: unknown,
  projectId: string,
  entry: { action: string; user: string; details: string },
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_activity_logs")
    .insert({
      project_id: projectId,
      action: entry.action,
      user_name: entry.user,
      details: entry.details,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    console.warn("[projects] addProjectActivityLog error:", error.message);
  }
}

/* ─── Watchers (Realtime) ─────────────────────────────────────────────────── */

export function watchActiveProjects(
  uid: string,
  onData: (projects: ProjectRecord[]) => void,
  onError: (error: Error) => void,
): () => void {
  const supabase = createClient();

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("projects")
      .select("*, project_team_members!inner(user_uid)")
      .eq("project_team_members.user_uid", uid)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      onError(new Error(error.message));
      return;
    }

    const projects = (data || []).map((row) => mapProjectDocument(String(row.id), row as Record<string, unknown>));

    onData(projects);
  }

  void fetchAndNotify();

  const channel = supabase
    .channel("active-projects-" + uid)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "projects" },
      () => { void fetchAndNotify(); },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "project_team_members" },
      () => { void fetchAndNotify(); },
    )
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" && err) {
        onError(new Error(String(err)));
      }
    });

  return () => { void supabase.removeChannel(channel); };
}

export async function fetchActiveProjects(uid: string): Promise<ProjectRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_team_members!inner(user_uid)")
    .eq("project_team_members.user_uid", uid)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => mapProjectDocument(String(row.id), row as Record<string, unknown>));
}

/* ─── Create ──────────────────────────────────────────────────────────────── */

export async function createProject(
  uid: string,
  ownerEmail: string | null,
  ownerName: string,
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  const supabase = createClient();
  const createdAt = new Date().toISOString();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert({
      uid,
      name: input.name.trim(),
      location: input.location?.trim() || "",
      status: input.status,
      file_count: getDefaultFileCount(),
      total_size: 0,
      is_deleted: false,
      deleted_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select()
    .single();

  if (projectError || !projectData) {
    throw new Error(projectError?.message || "Proje oluşturulamadı.");
  }

  const projectId = projectData.id;

  // Add owner to project_team_members
  const { error: memberError } = await supabase
    .from("project_team_members")
    .insert({
      project_id: projectId,
      user_uid: uid,
      email: ownerEmail,
      role: "owner",
    });

  if (memberError) {
    console.warn("[projects] createProject member insert error:", memberError.message);
  }

  await addProjectActivityLog(supabase, projectId, {
    action: "create",
    user: ownerName || ownerEmail || "Kullanıcı",
    details: "Proje oluşturuldu.",
  });

  return {
    id: projectId,
    uid,
    memberUids: [uid],
    name: input.name.trim(),
    location: input.location?.trim() || "",
    status: input.status,
    fileCount: getDefaultFileCount(),
    totalSize: 0,
    files: [],
    deletedFiles: [],
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

/* ─── Soft Delete ─────────────────────────────────────────────────────────── */

export async function softDeleteProject(projectId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function batchSoftDeleteProjects(projectIds: string[]) {
  if (!projectIds.length) return;

  const supabase = createClient();
  const now = new Date().toISOString();

  const updates = projectIds.map((id) =>
    supabase
      .from("projects")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id),
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }
}


/* ─── File Upload ─────────────────────────────────────────────────────────── */

export async function uploadProjectFiles(
  project: ProjectRecord,
  files: File[],
  ownerUid: string,
  ownerName: string,
  onProgress?: (fileName: string, progress: number) => void,
) {
  if (!files.length) return;

  const supabase = createClient();

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const storagePath = `users/${ownerUid}/projects/${project.id}/${Date.now()}_${safeName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("projects")
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        cacheControl: "public, max-age=31536000, immutable",
      });

    if (uploadError) {
      throw new Error(`${file.name} yüklenemedi: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("projects").getPublicUrl(storagePath);
    const url = urlData.publicUrl;
    const typeKey = getFileTypeKey(file.type || file.name);

    // Check for existing file with same name
    const { data: existingFiles } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", project.id)
      .eq("name", file.name)
      .eq("is_deleted", false);

    const existing = existingFiles?.[0];

    if (existing) {
      // Create version record
      const { error: versionError } = await supabase
        .from("project_file_versions")
        .insert({
          file_id: existing.id,
          version: ((existing.versions?.length || 0) + 1),
          url: existing.url,
          path: existing.path,
          storage_provider: existing.storage_provider || "supabase",
          object_key: existing.object_key,
          content_type: existing.content_type,
          size: existing.size,
          created_at: existing.created_at || new Date().toISOString(),
        });

      if (versionError) {
        console.warn("[projects] version insert error:", versionError.message);
      }

      // Update existing file
      const { error: updateError } = await supabase
        .from("project_files")
        .update({
          url,
          path: storagePath,
          size: file.size,
          type: file.type || file.name.split(".")[1]?.toLowerCase() || "dosya",
          storage_provider: "supabase",
          content_type: file.type,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // Insert new file
      const { error: insertError } = await supabase
        .from("project_files")
        .insert({
          project_id: project.id,
          name: file.name,
          url,
          size: file.size,
          type: file.type || file.name.split(".")[1]?.toLowerCase() || "dosya",
          path: storagePath,
          storage_provider: "supabase",
          content_type: file.type,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    // Update project file_count and total_size
    const { data: projectData } = await supabase
      .from("projects")
      .select("file_count, total_size")
      .eq("id", project.id)
      .single();

    const currentCount = projectData?.file_count as Record<string, number> || { pdf: 0, dwg: 0, img: 0 };
    const currentSize = (projectData?.total_size as number) || 0;

    const newCount = { ...currentCount };
    if (!existing) {
      newCount[typeKey] = (newCount[typeKey] || 0) + 1;
    }

    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({
        file_count: newCount,
        total_size: existing ? currentSize + file.size - (existing.size || 0) : currentSize + file.size,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (projectUpdateError) {
      throw new Error(projectUpdateError.message);
    }

    if (onProgress) {
      onProgress(file.name, 100);
    }

    await addProjectActivityLog(supabase, project.id, {
      action: "upload",
      user: ownerName,
      details: `${file.name} dosyası yüklendi.`,
    });
  }
}
