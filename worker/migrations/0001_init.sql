-- 宿舍分数可视化系统：初始数据模型与种子数据
-- 表结构详见 docs/API.md 与 开发计划.md §2

CREATE TABLE beds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('double', 'single')),
  sort INTEGER NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  bed_id INTEGER NOT NULL REFERENCES beds (id),
  position TEXT NOT NULL CHECK (position IN ('upper', 'lower', 'single')),
  sort INTEGER NOT NULL
);

CREATE TABLE daily_inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  duty_user_id INTEGER NOT NULL REFERENCES users (id),
  talk_am INTEGER NOT NULL DEFAULT 0,
  talk_pm INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE daily_user_status (
  inspection_id INTEGER NOT NULL REFERENCES daily_inspections (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  status TEXT NOT NULL CHECK (status IN ('NORMAL', 'LEAVE')),
  PRIMARY KEY (inspection_id, user_id)
);

CREATE TABLE inspection_bed_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL REFERENCES daily_inspections (id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  bed_id INTEGER NOT NULL REFERENCES beds (id),
  item TEXT NOT NULL CHECK (item IN ('BED', 'FLOOR')),
  UNIQUE (inspection_id, period, bed_id, item)
);

CREATE TABLE inspection_public_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL REFERENCES daily_inspections (id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  item TEXT NOT NULL CHECK (item IN ('TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE')),
  UNIQUE (inspection_id, period, item)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('VIEWER', 'ADMIN')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_inspections_date ON daily_inspections (date);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

-- 种子：床位（4 床 7 人）
INSERT INTO beds (id, name, type, sort) VALUES
  (1, '1床', 'double', 1),
  (2, '2床', 'double', 2),
  (3, '3床', 'double', 3),
  (4, '4床', 'single', 4);

INSERT INTO users (id, name, bed_id, position, sort) VALUES
  (1, 'User1', 1, 'upper', 1),
  (2, 'User2', 1, 'lower', 2),
  (3, 'User3', 2, 'upper', 3),
  (4, 'User4', 2, 'lower', 4),
  (5, 'User5', 3, 'upper', 5),
  (6, 'User6', 3, 'lower', 6),
  (7, 'User7', 4, 'single', 7);

-- 种子：初始密码（展示/管理均为 admin，PBKDF2-SHA256 100000 次迭代）
-- 首次部署后请在「管理页 → 设置」中尽快修改
INSERT INTO settings (key, value) VALUES
  ('admin_password_hash', 'pbkdf2$100000$ZG9ybXNjb3JlLXYxLXNlZWQ=$RXVqJhBuD3xrR2TPpAGDZLuaQmYDgPaug0cqduCUnl8='),
  ('viewer_password_hash', 'pbkdf2$100000$ZG9ybXNjb3JlLXYxLXNlZWQ=$RXVqJhBuD3xrR2TPpAGDZLuaQmYDgPaug0cqduCUnl8=');
