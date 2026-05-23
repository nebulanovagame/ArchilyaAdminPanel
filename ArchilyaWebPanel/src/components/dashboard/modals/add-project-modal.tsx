"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import type { CreateProjectInput } from "@/lib/projects/types";

const PROJECT_STATUS_OPTIONS = ["Aktif", "Taslak", "İncelemede", "Tamamlandı"] as const;

function getCreateProjectSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    name: z
      .string()
      .min(1, t("dashboard.projects.nameRequired"))
      .max(128, t("dashboard.projects.nameTooLong")),
    location: z
      .string()
      .max(128, t("dashboard.projects.locationTooLong"))
      .optional(),
    status: z.enum(PROJECT_STATUS_OPTIONS),
  });
}

type CreateProjectFormValues = z.infer<ReturnType<typeof getCreateProjectSchema>>;

export function AddProjectModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: CreateProjectInput) => Promise<void>;
}) {
  const t = useTranslations();
  const createProjectSchema = getCreateProjectSchema(t);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      location: "",
      status: "Aktif",
    },
  });

  async function onSubmit(data: CreateProjectFormValues) {
    try {
      await onAdd({
        name: data.name.trim(),
        location: data.location?.trim(),
        status: data.status,
      });
      toast.success(t("dashboard.projects.created"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.projects.createFailed"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-project-title"
        aria-describedby="add-project-desc"
        className="w-full max-w-md bg-[#0d0f13] border border-white/10 rounded-sm p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
          {t("dashboard.projects.new")}
        </p>
        <h2 id="add-project-title" className="text-2xl font-serif text-white italic mb-2">
          {t("dashboard.projects.createTitle")}
        </h2>
        <p id="add-project-desc" className="text-sm font-sans text-gray-400 mb-6">
          {t("dashboard.projects.createDescription")}
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">
              {t("dashboard.projects.name")}
            </label>
            <input
              type="text"
              placeholder="Villa Noir"
              {...register("name")}
              className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white font-sans placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {errors.name && (
              <p className="mt-1 text-[11px] text-red-400 font-sans">
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">
              {t("dashboard.projects.location")}
            </label>
            <input
              type="text"
              placeholder={t("dashboard.projects.locationPlaceholder")}
              {...register("location")}
              className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white font-sans placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {errors.location && (
              <p className="mt-1 text-[11px] text-red-400 font-sans">
                {errors.location.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">
              {t("dashboard.projects.status")}
            </label>
            <select
              {...register("status")}
              className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white font-sans focus:outline-none focus:border-primary/50 transition-colors appearance-none"
            >
              {PROJECT_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item} className="bg-[#0d0f13]">
                  {t(`dashboard.projects.${item === "Aktif" ? "statusActive" : item === "Taslak" ? "statusDraft" : item === "İncelemede" ? "statusReview" : "statusCompleted"}`)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-primary text-black font-sans font-bold text-xs uppercase tracking-widest py-3 rounded-sm hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? t("dashboard.projects.creating") : t("dashboard.projects.createSubmit")}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
