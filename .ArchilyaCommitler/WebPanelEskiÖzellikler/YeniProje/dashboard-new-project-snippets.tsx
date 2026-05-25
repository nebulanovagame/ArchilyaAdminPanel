const handleStartProjectCreation = useCallback(() => {
    if (!canManageProjects) {
      toast.error(projectMutationMessage);
      return;
    }

    setShowAddModal(true);
  }, [canManageProjects, projectMutationMessage]);

  useEffect(() => {
    if (searchParams.get("createProject") !== "1") return;

    router.replace(pathname);

    if (!canManageProjects) {
      toast.error(projectMutationMessage);
      return;
    }

    const timer = window.setTimeout(() => setShowAddModal(true), 0);
    return () => window.clearTimeout(timer);
  }, [canManageProjects, pathname, projectMutationMessage, router, searchParams]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let mounted = true;
    checkHasSeenOnboarding(currentUser.uid).then((seen) => {
      if (mounted && !seen) {
        setShowOnboarding(true);
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [currentUser?.uid]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const {
    projects,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    createProject,
    softDeleteProject,
    batchSoftDelete,
  } = useProjects(currentUser?.uid ?? null, currentUser?.email ?? null, ownerName, canManageProjects, projectMutationMessage, null);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.includes(project.id)),
    [projects, selectedProjectIds],
  );
