-- ============================================================
-- 德恒项目管理系统 — 初始数据库结构
-- ============================================================

-- 用户档案表（扩展 Supabase Auth 的 auth.users）
CREATE TABLE profiles (
  id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name    TEXT NOT NULL,
  email   TEXT NOT NULL UNIQUE,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目表
CREATE TABLE projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  client      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'delayed', 'completed', 'cancelled')),
  created_by  UUID REFERENCES profiles(id) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 工作记录表（仅软删除，禁止物理删除）
CREATE TABLE work_records (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  author_id  UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted    BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);

-- 工时记录表
CREATE TABLE time_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  member_id   UUID REFERENCES profiles(id) NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  description TEXT DEFAULT ''
);

-- ============================================================
-- 触发器：自动更新 projects.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 触发器：新用户注册时自动创建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 启用行级安全（RLS）
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles 策略
-- ============================================================
CREATE POLICY "已登录用户可查看所有档案" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "用户只能更新自己的档案" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- projects 策略
-- ============================================================
CREATE POLICY "已登录用户可查看所有项目" ON projects
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "仅管理员可新建项目" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "仅管理员可修改项目" ON projects
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- work_records 策略（禁止物理删除）
-- ============================================================
CREATE POLICY "已登录用户可查看所有工作记录" ON work_records
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "已登录用户可新增工作记录" ON work_records
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "作者或管理员可软删除记录" ON work_records
  FOR UPDATE USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 关键：禁止任何人物理删除工作记录
CREATE POLICY "禁止物理删除工作记录" ON work_records
  FOR DELETE USING (false);

-- ============================================================
-- time_logs 策略
-- ============================================================
CREATE POLICY "已登录用户可查看所有工时" ON time_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "已登录用户可新增工时" ON time_logs
  FOR INSERT WITH CHECK (auth.uid() = member_id);

CREATE POLICY "用户可更新自己的工时" ON time_logs
  FOR UPDATE USING (auth.uid() = member_id);

-- ============================================================
-- 开启 Realtime（在 Supabase 控制台 Database > Replication 中也需手动勾选）
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE work_records;
ALTER PUBLICATION supabase_realtime ADD TABLE time_logs;
