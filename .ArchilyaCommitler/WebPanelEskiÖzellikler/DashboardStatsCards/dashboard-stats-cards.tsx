  const statsCards = useMemo(
    () => [
      { icon: FolderOpen, label: "Aktif Proje", value: String(stats.activeCount), sub: `${stats.totalProjectCount} proje toplam`, color: "text-primary" },
      { icon: HardDrive, label: "Arşiv Boyutu", value: formatBytes(stats.totalSize), sub: "Depolama", color: "text-blue-400" },
      { icon: FileText, label: "Toplam Dosya", value: String(stats.totalFiles), sub: "PDF, DWG, Görsel", color: "text-emerald-400" },
      { icon: Users, label: "Ekip Üyesi", value: String(stats.uniqueMemberCount), sub: "Projelerinizde erişimi olanlar", color: "text-violet-400" },
    ],
    [stats],
  );

      <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }} className="bg-[#0d0f13] border border-white/5 rounded-sm p-5 hover:border-primary/20 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-sm bg-white/5 group-hover:bg-primary/10 transition-colors ${stat.color}`}><Icon className="w-4 h-4" /></div>
                <TrendingUp className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-2xl font-serif text-white mb-1">{loading ? "..." : stat.value}</p>
              <p className="text-[10px] font-sans text-gray-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-[10px] font-sans text-gray-700 mt-1">{stat.sub}</p>
            </motion.div>
          );
        })}
      </motion.div>
