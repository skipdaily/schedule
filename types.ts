
export type TaskStatus = 'not-started' | 'ready' | 'in-progress' | 'complete';

export type ScopeType = 'interior' | 'exterior';

export interface Trade {
  id: string;
  name: string;
  scope: ScopeType;
  defaultDurationDays: number;
  orderIndex: number;
}

export interface Unit {
  id: string;
  name: string;
  building: string;
  scope: ScopeType; // Usually 'interior'
}

export interface Area {
  id: string;
  name: string;
  building: string;
  scope: ScopeType; // Usually 'exterior'
}

export interface Task {
  id: string;
  unitId: string; // References Unit or Area ID
  tradeId: string;
  status: TaskStatus;
  expectedStartDate?: string; // ISO Date string YYYY-MM-DD
  completedDate?: string; // ISO Date string
  percentComplete?: number; // 0-100
  linkedToTaskKey?: string; // Custom link to another task (unitId_tradeId)
  lastUpdated: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  dataUrl: string; // Base64 data URL
  addedAt: string; // ISO date
}

export interface Project {
  id: string;
  name: string;
  address: string;
  projectedCompletionDate?: string;
  totalBuildings: number;
  trades: Trade[]; // Sequence is determined by array order
  units: Unit[];
  areas: Area[];
  tasks: Record<string, Task>; // Key is `${unitId}_${tradeId}`
  attachments?: Attachment[]; // Photos and PDFs
}

export interface ViewMode {
  current: 'dashboard' | 'matrix' | 'setup' | 'trades';
}