<span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><FileText className="w-3 h-3" /> {project.fileCount.pdf} PDF</span>
                    <span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><Box className="w-3 h-3" /> {project.fileCount.dwg} DWG</span>
                    <span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><ImageIcon className="w-3 h-3" /> {project.fileCount.img} Görsel</span>
                    {project.totalSize > 0 && <span className="ml-auto text-[10px] font-sans text-gray-700">{formatBytes(project.totalSize)}</span>}
                  </div>
