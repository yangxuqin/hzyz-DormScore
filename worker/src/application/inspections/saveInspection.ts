// 应用用例：录入/更新每日检查记录（校验 → 计算 → 仓储 → 审计）
import type { EnrichedRecord } from '@dorm/contracts';
import type { AppConfig } from '../../domain/dorm/model';
import { OPERATOR_NAME } from '../../domain/dorm/constants';
import { validateInspectionInput } from '../../domain/dorm/validation';
import { err, ok, type Result } from '../../shared/result';
import { todayInShanghai } from '../../shared/date';
import type { Repositories } from '../../infrastructure/repositories';
import { enrichRecord, normalizeRecord } from '../../interfaces/http/presenter';

export interface SaveInspectionCommand {
  /** 更新已有记录时携带；省略则按 date 查找 */
  id?: number;
  body: unknown;
}

export interface SaveInspectionOutcome {
  record: EnrichedRecord;
  action: 'created' | 'updated' | 'unchanged';
  config: AppConfig;
}

/**
 * 创建或更新某日记录。
 *
 * 流程：校验输入 → 定位目标记录（按 id 或 date）→ 校验日期冲突 →
 * 写库（date 唯一，同日重复提交即更新）→ 变更时写审计日志。
 */
export async function saveInspection(
  repos: Repositories,
  command: SaveInspectionCommand,
): Promise<Result<SaveInspectionOutcome>> {
  const config = await repos.config.getConfig();
  const parsed = validateInspectionInput(command.body, config, todayInShanghai());
  if (!parsed.ok) return parsed;
  const value = parsed.value;

  let target = null;
  if (typeof command.id === 'number' && Number.isInteger(command.id)) {
    target = await repos.inspections.getById(command.id);
    if (!target) return err('NOT_FOUND', '记录不存在');
    if (target.date !== value.date) {
      const conflicting = await repos.inspections.getByDate(value.date);
      if (conflicting && conflicting.id !== target.id) {
        return err('DATE_CONFLICT', '目标日期已存在另一条记录');
      }
    }
  } else {
    target = await repos.inspections.getByDate(value.date);
  }

  const before = target ? normalizeRecord(target) : null;
  const record = await repos.inspections.upsert(value);
  const after = normalizeRecord(record);
  const action: 'created' | 'updated' = target ? 'updated' : 'created';
  const changed = target === null || JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    const reason = readReason(command.body);
    await repos.audit.add({
      operator: OPERATOR_NAME,
      action: target ? 'UPDATE' : 'CREATE',
      target: `inspection:${value.date}`,
      beforeJson: target ? JSON.stringify(before) : null,
      afterJson: JSON.stringify(after),
      reason,
    });
  }

  return ok({
    record: enrichRecord(record, config),
    action: changed ? action : 'unchanged',
    config,
  });
}

function readReason(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === 'string' && reason.trim() !== '' ? reason.trim() : null;
}
