export interface DepthMap {
  sceneId: string;
  imageUrl: string;
  depthDataUrl: string;
  generatedAt: number;
}

export interface MetricLock {
  sceneId: string;
  aspectRatio: number;
  estimatedDepth: number;
  volumeScore: number;
  isLocked: boolean;
}

export interface ConsistencyResult {
  sceneIds: string[];
  consistencyScore: number;
  warnings: string[];
}

export interface SpatialSession {
  id: string;
  depthMaps: Record<string, DepthMap>;
  metricLocks: Record<string, MetricLock>;
  consistencyResult: ConsistencyResult | null;
  createdAt: number;
  updatedAt: number;
}
