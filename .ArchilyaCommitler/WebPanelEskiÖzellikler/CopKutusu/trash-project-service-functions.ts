export async function restoreProject(projectId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      is_deleted: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function batchRestoreProjects(projectIds: string[]) {
  if (!projectIds.length) return;

  const supabase = createClient();
  const now = new Date().toISOString();

  const updates = projectIds.map((id) =>
    supabase
      .from("projects")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
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

/* ─── Hard Delete ─────────────────────────────────────────────────────────── */

export async function hardDeleteProject(project: ProjectRecord) {
  const supabase = createClient();

  // Delete files from storage
  const allFiles = [...(project.files || []), ...(project.deletedFiles || [])];
  const paths = allFiles.map((f) => f.path).filter(Boolean) as string[];

  if (paths.length) {
    await supabase.storage.from("projects").remove(paths);
  }

  // Delete project (cascade will handle project_files and project_activity_logs)
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function batchHardDeleteProjects(projects: ProjectRecord[]) {
  if (!projects.length) return;

  const supabase = createClient();

  // Delete files from storage
  const allPaths: string[] = [];
  for (const project of projects) {
    const files = [...(project.files || []), ...(project.deletedFiles || [])];
    allPaths.push(...files.map((f) => f.path).filter(Boolean) as string[]);
  }

  if (allPaths.length) {
    await supabase.storage.from("projects").remove(allPaths);
  }

  // Delete projects
  const ids = projects.map((p) => p.id);
  const { error } = await supabase
    .from("projects")
    .delete()
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }
}

/* ─── Trash ───────────────────────────────────────────────────────────────── */

export function watchTrashData(
  uid: string,
  onData: (data: TrashData) => void,
  onError: (error: Error) => void,
): () => void {
  const supabase = createClient();

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("projects")
      .select("*, project_team_members!inner(user_uid), project_files(*)")
      .eq("project_team_members.user_uid", uid)
      .limit(100);

    if (error) {
      onError(new Error(error.message));
      return;
    }

    const allProjects = (data || []).map((row) => projectConverter.fromFirestore?.({
      id: String(row.id),
      data: () => row,
      exists: true,
    } as never, { id: String(row.id) } as never) || row as unknown as ProjectRecord);

    const deletedProjects = allProjects
      .filter((project) => project.isDeleted && project.uid === uid && shouldRetainTrashItem(project.deletedAt))
      .sort((a, b) => {
        const left = formatDateValue(a.deletedAt)?.getTime() || 0;
        const right = formatDateValue(b.deletedAt)?.getTime() || 0;
        return right - left;
      });

    const activeProjectsWithDeletedFiles = allProjects.filter(
      (project) => !project.isDeleted && (project.deletedFiles?.length || 0) > 0,
    );

    const deletedFiles = mapDeletedFiles(activeProjectsWithDeletedFiles).sort((a, b) => {
      const left = formatDateValue(a.deletedAt)?.getTime() || 0;
      const right = formatDateValue(b.deletedAt)?.getTime() || 0;
      return right - left;
    });

    onData({ deletedProjects, deletedFiles });
  }

  void fetchAndNotify();

  const channel = supabase
    .channel("trash-data-" + uid)
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "project_files" },
      () => { void fetchAndNotify(); },
    )
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" && err) {
        onError(new Error(String(err)));
      }
    });

  return () => { void supabase.removeChannel(channel); };
}

export async function fetchTrashData(uid: string): Promise<TrashData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_team_members!inner(user_uid), project_files(*)")
    .eq("project_team_members.user_uid", uid)
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const allProjects = (data || []).map((row) => projectConverter.fromFirestore?.({
    id: String(row.id),
    data: () => row,
    exists: true,
  } as never, { id: String(row.id) } as never) || row as unknown as ProjectRecord);

  const deletedProjects = allProjects
    .filter((project) => project.isDeleted && project.uid === uid && shouldRetainTrashItem(project.deletedAt))
    .sort((a, b) => {
      const left = formatDateValue(a.deletedAt)?.getTime() || 0;
      const right = formatDateValue(b.deletedAt)?.getTime() || 0;
      return right - left;
    });

  const activeProjectsWithDeletedFiles = allProjects.filter(
    (project) => !project.isDeleted && (project.deletedFiles?.length || 0) > 0,
  );

  const deletedFiles = mapDeletedFiles(activeProjectsWithDeletedFiles).sort((a, b) => {
    const left = formatDateValue(a.deletedAt)?.getTime() || 0;
    const right = formatDateValue(b.deletedAt)?.getTime() || 0;
    return right - left;
  });

  return { deletedProjects, deletedFiles };
}

/* ─── File Restore / Permanently Delete ───────────────────────────────────── */

export async function restoreDeletedFile(projectId: string, file: ProjectFileRecord) {
  const supabase = createClient();

  // Find the file in project_files
  const { data: fileData, error: findError } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", file.name)
    .eq("is_deleted", true)
    .single();

  if (findError || !fileData) {
    throw new Error("Dosya çöp kutusunda bulunamadı.");
  }

  const { error } = await supabase
    .from("project_files")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", fileData.id);

  if (error) {
    throw new Error(error.message);
  }

  // Update project file_count and total_size
  const { data: projectData } = await supabase
    .from("projects")
    .select("file_count, total_size")
    .eq("id", projectId)
    .single();

  const currentCount = projectData?.file_count as Record<string, number> || { pdf: 0, dwg: 0, img: 0 };
  const typeKey = getFileTypeKey(fileData.type || fileData.name);
  const newCount = { ...currentCount, [typeKey]: (currentCount[typeKey] || 0) + 1 };

  await supabase
    .from("projects")
    .update({
      file_count: newCount,
      total_size: ((projectData?.total_size as number) || 0) + (fileData.size || 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

export async function batchRestoreFiles(items: Array<{ projectId: string; file: ProjectFileRecord }>) {
  if (!items.length) return;

  for (const item of items) {
    await restoreDeletedFile(item.projectId, item.file);
  }
}

export async function permanentlyDeleteFile(projectId: string, file: ProjectFileRecord) {
  const supabase = createClient();

  // Find the file
  const { data: fileData, error: findError } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", file.name)
    .eq("is_deleted", true)
    .single();

  if (findError || !fileData) {
    throw new Error("Dosya bulunamadı.");
  }

  // Delete from storage
  if (fileData.path) {
    await supabase.storage.from("projects").remove([fileData.path]);
  }

  // Delete from database
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("id", fileData.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function batchPermanentlyDeleteFiles(items: Array<{ projectId: string; file: ProjectFileRecord }>) {
  if (!items.length) return;

  for (const item of items) {
    await permanentlyDeleteFile(item.projectId, item.file);
  }
}
