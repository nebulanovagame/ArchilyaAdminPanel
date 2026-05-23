import React from 'react';

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

interface ProjectFolderTreeProps {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  expandedIds: Set<string>;
}

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0"
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.3-.5l-2.8-2A2 2 0 0 0 6.8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const DocumentIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0"
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  expandedIds: Set<string>;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  depth,
  selectedId,
  onSelect,
  onToggleExpand,
  expandedIds,
}) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    onSelect(node.id);
    if (hasChildren) {
      onToggleExpand(node.id);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`
          group/tree-row w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors
          ${isSelected
            ? 'bg-archilya-gold/[0.06] text-archilya-gold border border-archilya-gold/10'
            : 'text-archilya-text-dim/65 hover:text-archilya-text hover:bg-white/[0.025] border border-transparent'
          }
        `}
      >
        {hasChildren ? (
          <span className="flex-shrink-0 w-3 flex items-center justify-center">
            <ChevronIcon expanded={isExpanded} />
          </span>
        ) : (
          <span className="flex-shrink-0 w-3" />
        )}

        {hasChildren ? <FolderIcon /> : <DocumentIcon />}

        <span className="truncate">{node.name}</span>
      </button>

      {hasChildren && isExpanded && (
        <div className="contents">
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              expandedIds={expandedIds}
            />
          ))}
        </div>
      )}
    </>
  );
};

export const ProjectFolderTree: React.FC<ProjectFolderTreeProps> = ({
  nodes,
  selectedId,
  onSelect,
  onToggleExpand,
  expandedIds,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/[0.03]">
        <span className="text-[10px] font-mono tracking-[0.3em] text-archilya-text-dim/40 uppercase">
          KLASÖRLER
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
        {nodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            expandedIds={expandedIds}
          />
        ))}
      </div>
    </div>
  );
};