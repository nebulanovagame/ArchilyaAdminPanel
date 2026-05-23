export function getStageNameKey(stageId: number): string {
  switch (stageId) {
    case 1:
      return "pipeline.stageAnalysisName";
    case 2:
      return "pipeline.stageMaterialName";
    case 3:
      return "pipeline.stageRenderName";
    case 4:
      return "pipeline.stageQualityName";
    default:
      return "";
  }
}

export function getStageDescriptionKey(stageId: number): string {
  switch (stageId) {
    case 1:
      return "pipeline.stageAnalysisDescription";
    case 2:
      return "pipeline.stageMaterialDescription";
    case 3:
      return "pipeline.stageRenderDescription";
    case 4:
      return "pipeline.stageQualityDescription";
    default:
      return "";
  }
}
