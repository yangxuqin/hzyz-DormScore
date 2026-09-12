// 仓储聚合：应用层依赖这组接口，测试可替换为内存实现
import type { AuditRepository } from './auditRepository';
import type { ConfigRepository } from './configRepository';
import type { InspectionRepository } from './inspectionRepository';
import type { SessionRepository } from './sessionRepository';

export interface Repositories {
  inspections: InspectionRepository;
  config: ConfigRepository;
  sessions: SessionRepository;
  audit: AuditRepository;
}

export type { AuditLogInput, AuditRepository } from './auditRepository';
export type { ConfigRepository } from './configRepository';
export type { InspectionRepository } from './inspectionRepository';
export type { SessionInfo, SessionRepository } from './sessionRepository';
