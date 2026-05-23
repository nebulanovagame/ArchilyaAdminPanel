import React, { useState, useCallback } from 'react';

export interface PromptTemplate {
  id: string;
  label: string;
  text: string;
}

interface PromptTemplatePickerProps {
  templates: PromptTemplate[];
  onSelect: (text: string) => void;
  title?: string;
}

export const PromptTemplatePicker: React.FC<PromptTemplatePickerProps> = ({
  templates,
  onSelect,
  title = "Hazır Promptlar",
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleClick = useCallback(
    (template: PromptTemplate) => {
      setActiveId(template.id);
      onSelect(template.text);
      setTimeout(() => setActiveId(null), 300);
    },
    [onSelect]
  );

  if (templates.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => {
          const isActive = activeId === template.id;
          return (
            <button
              key={template.id}
              onClick={() => handleClick(template)}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-display tracking-wider transition-all duration-200 ${
                isActive
                  ? 'border-archilya-gold/50 bg-archilya-gold/10 text-archilya-gold'
                  : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/60 hover:border-white/[0.14] hover:text-archilya-text hover:bg-white/[0.04]'
              }`}
            >
              {template.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
