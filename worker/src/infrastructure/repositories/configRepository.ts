// 配置仓储：床位/成员映射与密码哈希
import type { PasswordKey } from '@dorm/contracts';
import type { AppConfig, UserRow } from '../../domain/dorm/model';

export interface ConfigRepository {
  getConfig(): Promise<AppConfig>;
  updateMembers(users: UserRow[]): Promise<void>;
  getPasswordHash(key: PasswordKey): Promise<string | null>;
  setPasswordHash(key: PasswordKey, hash: string): Promise<void>;
}
