<motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
        <SectionHeader label="Yapay Zeka" title="AI Araçları" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.name} className="relative bg-[#0d0f13] border border-white/5 rounded-sm p-5 overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex flex-col items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    <span className="text-xs font-sans font-bold text-white uppercase tracking-widest">Yakında</span>
                  </div>
                </div>
                <div className="relative z-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 rounded-sm bg-primary/10 text-primary border border-primary/15"><Icon className="w-4 h-4" /></div>
                    <span className="text-[9px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">{tool.badge}</span>
                  </div>
                  <h3 className="text-base font-serif text-white italic mb-1">{tool.name}</h3>
                  <p className="text-xs font-sans text-gray-500 leading-relaxed mb-4">{tool.desc}</p>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-sans font-bold text-primary">{tool.credit} Kredi</span>
                    <span className="text-[10px] text-gray-700">/ kullanım</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
