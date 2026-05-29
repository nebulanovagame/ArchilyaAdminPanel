export function buildDefaultResetState() {
  return {
    style: "modern",
    extraNote: "",
    analysisFocus: ["material", "light", "composition", "presentation"] as string[],
    multiAnglePreserve: ["atmosphere", "lighting", "wood", "wall"] as string[],
    revisionType: "general",
    atmosphere: "golden-hour",
    materialLanguage: "natural-wood",
    styleStrength: "medium",
    enhancePreserve: ["perspective", "massing", "window-position", "furniture-layout"] as string[],
    scenePreserveAreas: ["perspective", "massing"] as string[],
    planType: "floor-plan",
    palette: "warm-premium",
    roomLabels: true,
    presentationStyle: "clean-modern",
    reportTone: "professional",
  };
}
