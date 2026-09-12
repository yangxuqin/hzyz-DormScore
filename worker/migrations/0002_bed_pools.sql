-- V2 扣分池模型迁移
--
-- 旧模型：inspection_bed_checks 每行 = (inspection_id, period, bed_id, item)，语义上
--         「一张床的一个区域命中一次」，V1 计算时乘以 2 分/行。
-- 新模型：一个扣分池 = (inspection_id, period, item)，固定扣 deduction_points 分；
--         命中床位记录在 inspection_bed_check_beds，只用于确定责任分摊范围。
--
-- 迁移为无损转换：旧行 (period, bed, item) ⇔ 新池 (period, item) + 床位关联 (bed)。
-- 例：旧 AM/FLOOR/1 与 AM/FLOOR/3 → 一个新池 AM/FLOOR，beds=[1,3]，扣 2 分（而非 4 分）。

-- 1) 旧表改名，保留至一致性校验通过
ALTER TABLE inspection_bed_checks RENAME TO inspection_bed_checks_legacy;

-- 2) 新池表：同一记录的「时段 × 区域」只允许一个池
CREATE TABLE inspection_bed_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL REFERENCES daily_inspections (id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  item TEXT NOT NULL CHECK (item IN ('BED', 'FLOOR')),
  -- 历史扣分快照，未来规则调整不重算历史
  deduction_points INTEGER NOT NULL DEFAULT 2 CHECK (deduction_points >= 0),
  UNIQUE (inspection_id, period, item)
);

-- 3) 池 ↔ 命中床位
CREATE TABLE inspection_bed_check_beds (
  check_id INTEGER NOT NULL REFERENCES inspection_bed_checks (id) ON DELETE CASCADE,
  bed_id INTEGER NOT NULL REFERENCES beds (id),
  PRIMARY KEY (check_id, bed_id),
  UNIQUE (check_id, bed_id)
);

CREATE INDEX idx_bed_pools_inspection ON inspection_bed_checks (inspection_id);
CREATE INDEX idx_bed_pool_beds_check ON inspection_bed_check_beds (check_id);

-- 4) 合并旧明细为扣分池（每个 period+item 一个池，固定 2 分）
INSERT INTO inspection_bed_checks (inspection_id, period, item, deduction_points)
SELECT DISTINCT l.inspection_id, l.period, l.item, 2
FROM inspection_bed_checks_legacy l;

-- 5) 把旧行对应的床位挂到新池上（去重）
INSERT INTO inspection_bed_check_beds (check_id, bed_id)
SELECT c.id, l.bed_id
FROM inspection_bed_checks_legacy l
JOIN inspection_bed_checks c
  ON c.inspection_id = l.inspection_id AND c.period = l.period AND c.item = l.item
GROUP BY c.id, l.bed_id;

-- 6) 一致性检查：每个旧行都必须恰好映射到一个床位关联；不满足则迁移中止
CREATE TABLE _migration_assert_v2 (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _migration_assert_v2 (ok)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM inspection_bed_checks_legacy)
       = (SELECT COUNT(*) FROM inspection_bed_check_beds)
  THEN 1
  ELSE 0
END;
DROP TABLE _migration_assert_v2;

-- 7) 校验通过，删除旧表（转换无损，可从新池 + 床位完整还原）
DROP TABLE inspection_bed_checks_legacy;
