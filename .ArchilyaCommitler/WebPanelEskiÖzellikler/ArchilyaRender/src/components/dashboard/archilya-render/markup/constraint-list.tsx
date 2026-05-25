"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useMarkupContext } from "@/stores/markup-store";
import type { ConstraintType } from "@/lib/types/markup";

const constraintTypes: ConstraintType[] = ["CHANGE", "REMOVE", "KEEP", "ADD"];

export default function ConstraintList() {
  const t = useTranslations("dashboard.archilyaRender");
  const { constraints, activeSceneId, updateConstraint, removeAnnotation } = useMarkupContext();
  const visibleConstraints = constraints.filter(
    (constraint) => constraint.sceneId === activeSceneId,
  );

  return (
    <aside className="h-full rounded-sm border border-white/10 bg-[#0d0f13] p-4">
      <div className="border-b border-white/10 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
          {t("markup.constraintPanel")}
        </p>
        <h3 className="mt-1 text-xl font-serif italic text-white">{t("markup.markupReading")}</h3>
      </div>

      <div className="mt-4 space-y-3">
        {visibleConstraints.length === 0 ? (
          <p className="rounded-sm border border-white/10 bg-white/[0.02] p-4 text-xs text-gray-500">
            {t("markup.constraintAppearsHere")}
          </p>
        ) : (
          visibleConstraints.map((constraint, index) => (
            <div key={constraint.id} className="rounded-sm border border-white/10 bg-[#0A0A0F] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Annotation {index + 1}
                </span>
                  <button
                  type="button"
                  onClick={() => removeAnnotation(constraint.annotationId)}
                  className="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10 text-gray-500 transition-colors hover:border-[#FF4757]/30 hover:text-[#FF4757]"
                  aria-label={t("markup.deleteConstraint")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <select
                  value={constraint.type}
                  onChange={(event) =>
                    updateConstraint(constraint.annotationId, {
                      type: event.target.value as ConstraintType,
                    })
                  }
                  className="rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-300 outline-none transition-colors focus:border-[#6C63FF]/50"
                >
                  {constraintTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={constraint.targetArea}
                  onChange={(event) =>
                    updateConstraint(constraint.annotationId, { targetArea: event.target.value })
                  }
                  placeholder={t("markup.targetArea")}
                  className="rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 outline-none transition-colors placeholder:text-gray-600 focus:border-[#6C63FF]/50"
                />

                <textarea
                  value={constraint.description}
                  onChange={(event) =>
                    updateConstraint(constraint.annotationId, { description: event.target.value })
                  }
                  placeholder={t("markup.addDescription")}
                  rows={3}
                  className="resize-none rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-gray-300 outline-none transition-colors placeholder:text-gray-600 focus:border-[#6C63FF]/50"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
