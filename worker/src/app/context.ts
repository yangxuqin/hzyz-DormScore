// Hono 应用上下文：绑定（Env）与请求级变量（Repositories / 会话信息）
import type { Role } from '@dorm/contracts';
import type { Repositories } from '../infrastructure/repositories';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

export interface AppVariables {
  repos: Repositories;
  role: Role | null;
  tokenHash: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

export type RepositoriesFactory = (env: Env) => Repositories;
