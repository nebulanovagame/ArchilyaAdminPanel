import { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { HomeView } from './views/HomeView';
import { NewsView } from './views/NewsView';
import { ProjectsView } from './views/ProjectsView';
import { BoardsView } from './views/BoardsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { AiStudioView } from './views/AiStudioView';
import { AiGalleryView } from './views/AiGalleryView';
import { VrLibraryView } from './views/VrLibraryView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { TrashView } from './views/TrashView';
import { TeamView } from './views/TeamView';
import { Login } from './components/Login';
import type { UserData } from '../shared/types';
import type { NavItem } from './components/Sidebar';

function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<NavItem>('home');
  const [activeProject, setActiveProject] = useState<{ id: string; name: string } | null>(null);
  const [workMode, setWorkMode] = useState<'solo' | 'office'>('office');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const existingUser = await window.api.checkSession();
        if (existingUser) {
          setUser(existingUser);
        }
      } catch (error) {
        console.error('Session check failed', error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    await window.api.logout();
    setUser(null);
    setActiveView('home');
    setActiveProject(null);
  };

  const handleNavigate = (item: NavItem) => {
    setActiveView(item);
    setActiveProject(null);
  };

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setActiveProject({ id: projectId, name: projectName });
  };

  const handleProjectBack = () => {
    setActiveProject(null);
  };

  const renderView = () => {
    if (!user) return <Login onLoginSuccess={setUser} />;

    if (activeProject && activeView === 'projects') {
      const projectPath = `C:\\Users\\${process.env.USERNAME || 'PC'}\\Archilya_Projects\\${activeProject.name}`;
      return (
        <ProjectDetailView
          projectName={activeProject.name}
          projectId={activeProject.id}
          projectPath={projectPath}
          onBack={handleProjectBack}
          workMode={workMode}
        />
      );
    }

    switch (activeView) {
      case 'home':
        return <HomeView user={user} onLogout={handleLogout} onOpenNews={() => handleNavigate('news')} workMode={workMode} />;
      case 'news':
        return <NewsView />;
      case 'projects':
        return <ProjectsView onProjectSelect={handleProjectSelect} user={user} />;
      case 'boards':
        return <BoardsView />;
      case 'ai-studio':
        return <AiStudioView />;
      case 'ai-gallery':
        return <AiGalleryView />;
      case 'vr-library':
        return <VrLibraryView />;
      case 'activity':
        return <ActivityView user={user} />;
      case 'trash':
        return <TrashView user={user} />;
      case 'settings':
        return <SettingsView workMode={workMode} onWorkModeChange={setWorkMode} onLogout={handleLogout} user={user} />;
      case 'team':
        return <TeamView user={user} />;
      default:
        return <HomeView user={user} onLogout={handleLogout} onOpenNews={() => handleNavigate('news')} />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-archilya-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-archilya-panel border-t-archilya-gold rounded-full animate-spin"></div>
          <span className="text-archilya-gold text-xs tracking-[0.5em] animate-pulse">SİSTEM BAŞLATILIYOR</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-archilya-dark text-archilya-text font-body selection:bg-archilya-gold selection:text-black">
      {/* Grain/Noise Dokusu */}
      <div className="grain-overlay"></div>

      {/* Arka Plan */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20 grayscale mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-archilya-dark via-transparent to-archilya-dark opacity-90"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-archilya-dark/80 via-transparent to-archilya-dark/80"></div>
      </div>

      {/* İçerik Katmanı */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Title Bar */}
        <TitleBar />

        {/* Ana Layout: Sidebar + Content */}
        <div className="flex-1 flex overflow-hidden">
          {user && (
            <Sidebar active={activeView} onNavigate={handleNavigate} workMode={workMode} user={user} />
          )}

          <div className="flex-1 flex flex-col min-w-0">
            {/* Dinamik Ana İçerik */}
            {renderView()}

            {/* Status Bar */}
            {user && <StatusBar />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
