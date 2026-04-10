-- 修复 handle_new_user 触发器
-- 问题：函数运行时 search_path 不含 public，找不到 profiles 表
-- 解决：显式设置 search_path = public

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;
