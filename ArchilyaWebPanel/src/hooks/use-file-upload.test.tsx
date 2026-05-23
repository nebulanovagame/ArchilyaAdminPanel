// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useFileUpload } from "@/hooks/use-file-upload";
import type { ProjectRecord } from "@/lib/projects/types";

vi.mock("@/lib/projects/service", () => ({
  uploadProjectFiles: vi.fn(),
}));

import { uploadProjectFiles } from "@/lib/projects/service";

const mockProject: ProjectRecord = {
  id: "proj-1",
  uid: "user-1",
  memberUids: ["user-1"],
  name: "Test Project",
  location: "İstanbul",
  status: "Aktif",
  fileCount: { pdf: 0, dwg: 0, img: 0 },
  totalSize: 0,
  files: [],
  deletedFiles: [],
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("useFileUpload", () => {
  it("initial state has uploading=false and empty progress", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toEqual({});
  });

  it("sets uploading=true during upload and resets after success", async () => {
    let progressCb: ((fileName: string, p: number) => void) | null = null;

    vi.mocked(uploadProjectFiles).mockImplementation(
      (_project, _files, _uid, _name, onProgress) => {
        progressCb = onProgress ?? null;
        return new Promise((resolve) => {
          setTimeout(() => {
            onProgress?.("file1.pdf", 50);
            onProgress?.("file1.pdf", 100);
            resolve();
          }, 10);
        });
      }
    );

    const { result } = renderHook(() => useFileUpload());

    const file = new File(["content"], "file1.pdf", { type: "application/pdf" });

    act(() => {
      result.current.uploadFiles(mockProject, [file], "user-1", "Test User");
    });

    expect(result.current.uploading).toBe(true);

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.progress).toEqual({});
  });

  it("updates progress during upload", async () => {
    vi.mocked(uploadProjectFiles).mockImplementation(
      (_project, _files, _uid, _name, onProgress) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            onProgress?.("file2.dwg", 25);
            onProgress?.("file2.dwg", 75);
            onProgress?.("file2.dwg", 100);
            resolve();
          }, 10);
        });
      }
    );

    const { result } = renderHook(() => useFileUpload());
    const file = new File(["content"], "file2.dwg", { type: "application/dwg" });

    await act(async () => {
      await result.current.uploadFiles(mockProject, [file], "user-1", "Test User");
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.progress).toEqual({});
  });

  it("resets uploading even when upload fails", async () => {
    vi.mocked(uploadProjectFiles).mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderHook(() => useFileUpload());
    const file = new File(["content"], "file3.pdf", { type: "application/pdf" });

    await expect(
      act(async () => {
        await result.current.uploadFiles(mockProject, [file], "user-1", "Test User");
      })
    ).rejects.toThrow("Upload failed");

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toEqual({});
  });
});
