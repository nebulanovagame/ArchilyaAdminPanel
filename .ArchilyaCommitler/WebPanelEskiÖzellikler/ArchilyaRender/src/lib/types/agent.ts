export type AgentRole = "ORCHESTRATOR" | "ANALYST" | "MATERIAL" | "RENDER" | "QC" | "REVISION";

export type AgentStatus = "IDLE" | "THINKING" | "WORKING" | "DONE" | "ERROR" | "WAITING";

export interface AgentMessage {
  agentRole: AgentRole;
  content: string;
  timestamp: number;
  type: "thought" | "action" | "result" | "error";
}

export interface AgentState {
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string;
  progress: number;
  messages: AgentMessage[];
}

export interface PipelineStage {
  id: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  status: "PENDING" | "ACTIVE" | "APPROVED" | "REJECTED" | "DONE";
}

export interface JobState {
  jobId: string;
  sessionId: string;
  stages: PipelineStage[];
  agents: AgentState[];
  currentStageId: PipelineStage["id"];
  overallProgress: number;
  startedAt: number;
  completedAt?: number;
}
