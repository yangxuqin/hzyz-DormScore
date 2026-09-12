// 应用用例：设置（成员映射、密码）—— 校验 + 审计
import type { AppConfig, PasswordKey } from '@dorm/contracts';
import { OPERATOR_NAME } from '../../domain/dorm/constants';
import { validateMembersInput, validatePasswordChangeInput } from '../../domain/dorm/validation';
import { hashPassword, verifyPassword } from '../../auth/password';
import { err, ok, type Result } from '../../shared/result';
import type { Repositories } from '../../infrastructure/repositories';

/** 修改成员姓名 / 床位映射 */
export async function updateMembers(
  repos: Repositories,
  body: unknown,
): Promise<Result<AppConfig>> {
  const current = await repos.config.getConfig();
  const parsed = validateMembersInput(body, current);
  if (!parsed.ok) return parsed;
  await repos.config.updateMembers(parsed.value.users);
  await repos.audit.add({
    operator: OPERATOR_NAME,
    action: 'UPDATE_CONFIG',
    target: 'members',
    beforeJson: JSON.stringify(current.users),
    afterJson: JSON.stringify(parsed.value.users),
    reason: null,
  });
  return ok(await repos.config.getConfig());
}

/** 修改展示 / 管理密码（需当前管理密码确认） */
export async function changePasswords(repos: Repositories, body: unknown): Promise<Result<null>> {
  const parsed = validatePasswordChangeInput(body);
  if (!parsed.ok) return parsed;
  const currentHash = await repos.config.getPasswordHash('admin');
  if (!currentHash || !(await verifyPassword(parsed.value.currentAdminPassword, currentHash))) {
    return err('INVALID_CURRENT_PASSWORD', '当前管理密码不正确');
  }
  const targets: { key: PasswordKey; value: string; target: string }[] = [];
  if (parsed.value.viewerPassword) {
    targets.push({ key: 'viewer', value: parsed.value.viewerPassword, target: 'viewer_password' });
  }
  if (parsed.value.adminPassword) {
    targets.push({ key: 'admin', value: parsed.value.adminPassword, target: 'admin_password' });
  }
  for (const { key, value, target } of targets) {
    await repos.config.setPasswordHash(key, await hashPassword(value));
    await repos.audit.add({
      operator: OPERATOR_NAME,
      action: 'CHANGE_PASSWORD',
      target,
      beforeJson: null,
      afterJson: JSON.stringify({ changed: true }),
      reason: null,
    });
  }
  return ok(null);
}
