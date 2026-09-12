// 应用用例：撤回 / 恢复每日检查记录（幂等 + 审计留痕）
import type { EnrichedRecord, InspectionStatus } from '@dorm/contracts';
import { OPERATOR_NAME } from '../../domain/dorm/constants';
import { err, ok, type Result } from '../../shared/result';
import type { Repositories } from '../../infrastructure/repositories';
import { enrichRecord } from '../../interfaces/http/presenter';

export interface SetInspectionStatusCommand {
  id: string | number;
  reason?: unknown;
}

export interface SetInspectionStatusOutcome {
  record: EnrichedRecord;
  action: 'updated' | 'unchanged';
}

async function setStatus(
  repos: Repositories,
  command: SetInspectionStatusCommand,
  next: InspectionStatus,
  auditAction: 'REVOKE' | 'RESTORE',
): Promise<Result<SetInspectionStatusOutcome>> {
  const id = Number(command.id);
  if (!Number.isInteger(id) || id <= 0) return err('INVALID_ID', '无效的记录 ID');

  const record = await repos.inspections.getById(id);
  if (!record) return err('NOT_FOUND', '记录不存在');

  if (record.status === next) {
    const config = await repos.config.getConfig();
    return ok({ record: enrichRecord(record, config), action: 'unchanged' });
  }

  const reason =
    typeof command.reason === 'string' && command.reason.trim() !== ''
      ? command.reason.trim()
      : null;

  const updated = (await repos.inspections.setStatus(id, next))!;
  await repos.audit.add({
    operator: OPERATOR_NAME,
    action: auditAction,
    target: `inspection:${record.date}`,
    beforeJson: JSON.stringify({ status: record.status }),
    afterJson: JSON.stringify({ status: next }),
    reason,
  });

  const config = await repos.config.getConfig();
  return ok({ record: enrichRecord(updated, config), action: 'updated' });
}

export function revokeInspection(
  repos: Repositories,
  command: SetInspectionStatusCommand,
): Promise<Result<SetInspectionStatusOutcome>> {
  return setStatus(repos, command, 'REVOKED', 'REVOKE');
}

export function restoreInspection(
  repos: Repositories,
  command: SetInspectionStatusCommand,
): Promise<Result<SetInspectionStatusOutcome>> {
  return setStatus(repos, command, 'ACTIVE', 'RESTORE');
}
