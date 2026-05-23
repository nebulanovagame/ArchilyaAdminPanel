import React from 'react';

interface FilePreviewContentProps {
  filename: string;
  zoom: number;
}

const FilePreviewContent: React.FC<FilePreviewContentProps> = ({ filename, zoom }) => {
  const getFileType = () => {
    if (filename.endsWith('.dwg')) return 'dwg';
    if (filename.endsWith('.pdf')) return 'pdf';
    if (filename.endsWith('.skp') || filename.endsWith('.rvt') || filename.endsWith('.3ds')) return '3d';
    if (filename.endsWith('.jpg') || filename.endsWith('.png')) return 'image';
    return 'generic';
  };

  const fileType = getFileType();

  const renderDWG = () => (
    <div className="relative w-full h-full bg-blue-950/30 overflow-hidden">
      {/* Blueprint grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      {/* Center image */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative max-w-full max-h-full">
          <img
            src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80"
            alt="Blueprint"
            className="max-w-full max-h-full object-contain"
          />
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-blue-400" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-blue-400" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-blue-400" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-blue-400" />
        </div>
      </div>
      {/* Text overlay */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-blue-300">
        1:100 Ölçek · A1 Pafta
      </div>
    </div>
  );

  const renderPDF = () => (
    <div className="relative w-full h-full bg-white/[0.08] flex items-center justify-center p-8 overflow-hidden">
      {/* Page with shadow */}
      <div className="relative shadow-2xl shadow-black/50">
        <img
          src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&q=80"
          alt="PDF Document"
          className="max-w-full max-h-[80vh] object-contain block"
        />
        {/* Page curl effect */}
        <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[32px] border-b-[32px] border-l-transparent border-b-gray-400/40" />
      </div>
    </div>
  );

  const render3D = () => (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black overflow-hidden">
      <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono z-10">
        3D Model Preview
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative max-w-full max-h-full">
          <img
            src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80"
            alt="3D Model"
            className="max-w-full max-h-full object-contain"
          />
          {/* Axis lines overlay */}
          <svg className="absolute bottom-4 left-4 w-20 h-20 pointer-events-none" viewBox="0 0 100 100">
            <line x1="10" y1="90" x2="90" y2="90" stroke="#ef4444" strokeWidth="2" />
            <line x1="10" y1="90" x2="10" y2="10" stroke="#22c55e" strokeWidth="2" />
            <line x1="10" y1="90" x2="70" y2="30" stroke="#3b82f6" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );

  const renderImage = () => (
    <div className="w-full h-full flex items-center justify-center bg-black/20">
      <img
        src="https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=1200&q=80"
        alt="Preview"
        className="w-full h-full object-contain"
      />
    </div>
  );

  const renderGeneric = () => {
    const extension = filename.split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/50 text-gray-400">
        {/* File icon */}
        <svg
          width="64"
          height="80"
          viewBox="0 0 64 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-4 text-gray-500"
        >
          <path
            d="M4 4C4 1.79086 5.79086 0 8 0H40L60 20V76C60 78.2091 58.2091 80 56 80H8C5.79086 80 4 78.2091 4 76V4Z"
            fill="currentColor"
            fillOpacity="0.1"
          />
          <path
            d="M40 0L60 20H44C41.7909 20 40 18.2091 40 16V0Z"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M8 0H40L60 20V76C60 78.2091 58.2091 80 56 80H8C5.79086 80 4 78.2091 4 76V4C4 1.79086 5.79086 0 8 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M40 0L60 20H44C41.7909 20 40 18.2091 40 16V0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        {/* Text */}
        <p className="text-sm mb-2">Önizleme mevcut değil</p>
        {/* File type badge */}
        <span className="px-2 py-1 text-xs font-mono bg-gray-700 text-gray-300 rounded">
          {extension}
        </span>
      </div>
    );
  };

  const renderContent = () => {
    switch (fileType) {
      case 'dwg': return renderDWG();
      case 'pdf': return renderPDF();
      case '3d': return render3D();
      case 'image': return renderImage();
      default: return renderGeneric();
    }
  };

  return (
    <div className="w-full h-full overflow-hidden">
      <div
        className="w-full h-full transition-transform duration-200 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default FilePreviewContent;
