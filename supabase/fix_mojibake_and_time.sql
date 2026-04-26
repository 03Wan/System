-- Fix common mojibake text and timezone defaults in Supabase PostgreSQL.
-- Run in SQL Editor once.

begin;

-- 1) Align DB/session timezone to Asia/Shanghai
alter database postgres set timezone to 'Asia/Shanghai';
alter role postgres set timezone to 'Asia/Shanghai';

-- 2) Repair common garbled messages in system_log
update public.system_log
set message = case
  when lower(action) = 'login' then '登录成功'
  when lower(action) = 'logout' then '退出登录'
  when lower(action) = 'upload' then '上传文档'
  when lower(action) = 'download' then '下载文件'
  when lower(action) = 'detect' then '执行论文检测'
  when lower(action) = 'create' then '创建数据'
  when lower(action) = 'update' then '更新数据'
  when lower(action) = 'delete' then '删除数据'
  else message
end
where message ~ '[娴鏍璇閺缂锟]';

-- 3) Attempt generic mojibake repair for common name/title fields
create or replace function public.try_fix_mojibake_gb18030(input_text text)
returns text
language plpgsql
as $$
declare
  fixed text;
begin
  if input_text is null or input_text = '' then
    return input_text;
  end if;

  begin
    fixed := convert_from(convert_to(input_text, 'GB18030'), 'UTF8');
  exception when others then
    return input_text;
  end;

  if fixed is null or fixed = '' then
    return input_text;
  end if;

  return fixed;
end;
$$;

update public.sys_user
set real_name = public.try_fix_mojibake_gb18030(real_name)
where real_name ~ '[娴鏍璇閺缂锟]';

update public.paper
set title = public.try_fix_mojibake_gb18030(title)
where title ~ '[娴鏍璇閺缂锟]';

update public.format_template
set template_name = public.try_fix_mojibake_gb18030(template_name),
    description = public.try_fix_mojibake_gb18030(description)
where template_name ~ '[娴鏍璇閺缂锟]' or description ~ '[娴鏍璇閺缂锟]';

update public.format_rule
set rule_name = public.try_fix_mojibake_gb18030(rule_name),
    description = public.try_fix_mojibake_gb18030(description)
where rule_name ~ '[娴鏍璇閺缂锟]' or description ~ '[娴鏍璇閺缂锟]';

commit;

-- Optional: check
-- select id, action, message, created_at from public.system_log order by id desc limit 20;
