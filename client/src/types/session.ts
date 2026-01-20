import type { SceneType } from '@/lib/waveEngine';

export interface BackendSession {
  sessionId: string;
  startTime: number;
  endTime?: number | null;
  duration?: number;
  securityScore?: number;
  sceneDistribution?: Record<SceneType, number>;
  eventCounts?: Record<string, number>;
  insights?: string[];
}
