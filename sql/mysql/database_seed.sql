SET NAMES utf8mb4;
USE thesis_check_system;

START TRANSACTION;

-- =============================
-- 1) 用户初始化（普通用户 + 管理员）
-- 说明：为便于联调，password_hash 暂用明文，兼容当前后端登录逻辑
-- 普通用户：user01 / user123456
-- 管理员：admin01 / admin123456
-- =============================
INSERT INTO sys_user (
  username, password_hash, role, real_name, email, phone, status, created_at, updated_at
) VALUES (
  'user01', 'user123456', 'USER', '测试用户', 'user01@example.com', '13800000001', 1, NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  role = VALUES(role),
  real_name = VALUES(real_name),
  email = VALUES(email),
  phone = VALUES(phone),
  status = 1,
  updated_at = NOW();
SET @user_id = LAST_INSERT_ID();

INSERT INTO sys_user (
  username, password_hash, role, real_name, email, phone, status, created_at, updated_at
) VALUES (
  'admin01', 'admin123456', 'ADMIN', '系统管理员', 'admin01@example.com', '13800000002', 1, NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  role = VALUES(role),
  real_name = VALUES(real_name),
  email = VALUES(email),
  phone = VALUES(phone),
  status = 1,
  updated_at = NOW();
SET @admin_id = LAST_INSERT_ID();

-- =============================
-- 2) 论文示例 + 上传文件记录示例（占位路径）
-- =============================
INSERT INTO paper (
  author_id, title, abstract_text, keywords, status, current_version, created_at, updated_at
)
SELECT
  @user_id,
  '基于 Word 格式检测的论文管理系统设计与实现',
  '本文围绕论文格式规范化与自动检测展开研究，提出一套基于 Flask 与 Vue 的论文检测系统。',
  '论文格式检测,自动排版,Flask,Vue3',
  'SUBMITTED',
  2,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM paper
  WHERE author_id = @user_id
    AND title = '基于 Word 格式检测的论文管理系统设计与实现'
    AND deleted_at IS NULL
);

SET @paper_id = (
  SELECT id FROM paper
  WHERE author_id = @user_id
    AND title = '基于 Word 格式检测的论文管理系统设计与实现'
    AND deleted_at IS NULL
  ORDER BY id DESC
  LIMIT 1
);

INSERT INTO file_record (
  uploader_id, paper_id, file_type, biz_ref_type, biz_ref_id,
  original_name, stored_name, storage_path, file_ext, mime_type, file_size, md5, is_deleted,
  created_at, updated_at
) VALUES (
  @user_id, @paper_id, 'PAPER_ORIGINAL', 'PAPER', @paper_id,
  '论文初稿.docx', 'seed_user01_paper_v1.docx', 'D:/桌面/1/uploads/seed_user01_paper_v1.docx',
  '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  204800, '11111111111111111111111111111111', 0, NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  storage_path = VALUES(storage_path),
  file_size = VALUES(file_size),
  updated_at = NOW();

INSERT INTO file_record (
  uploader_id, paper_id, file_type, biz_ref_type, biz_ref_id,
  original_name, stored_name, storage_path, file_ext, mime_type, file_size, md5, is_deleted,
  created_at, updated_at
) VALUES (
  @user_id, @paper_id, 'PAPER_ORIGINAL', 'PAPER', @paper_id,
  '论文终稿.docx', 'seed_user01_paper_v2.docx', 'D:/桌面/1/uploads/seed_user01_paper_v2.docx',
  '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 256000, '22222222222222222222222222222222', 0, NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  storage_path = VALUES(storage_path),
  file_size = VALUES(file_size),
  updated_at = NOW();

-- =============================
-- 3) 默认模板
-- =============================
INSERT INTO format_template (
  template_name, description, scope, version_no, template_file_id, creator_id,
  is_default, status, published_at, created_at, updated_at
) VALUES (
  '默认论文模板', '系统默认论文格式模板（本科通用）', 'SYSTEM', 'v1.0.0', NULL, @admin_id,
  1, 1, NOW(), NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  description = VALUES(description),
  scope = VALUES(scope),
  status = 1,
  is_default = 1,
  updated_at = NOW();
SET @template_id = LAST_INSERT_ID();

-- =============================
-- 4) 格式检测规则（若干）
-- =============================
INSERT INTO format_rule (
  template_id, parent_rule_id, rule_code, rule_name, rule_type, severity,
  rule_config, description, order_no, enabled, created_at, updated_at
) VALUES
(
  @template_id, NULL, 'PAGE_MARGIN', '页面边距检测', 'PAGE', 'ERROR',
  JSON_OBJECT('top_cm', 2.54, 'bottom_cm', 2.54, 'left_cm', 3.17, 'right_cm', 3.17),
  '检测 A4 页面边距是否符合标准', 10, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'BODY_FONT', '正文字体检测', 'FONT', 'ERROR',
  JSON_OBJECT('font_name', '宋体'),
  '检测正文是否为宋体', 20, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'BODY_FONT_SIZE', '正文字号检测', 'FONT', 'ERROR',
  JSON_OBJECT('font_size_pt', 12),
  '检测正文字号是否为小四（12pt）', 30, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'BODY_LINE_SPACING', '正文行距检测', 'PARAGRAPH', 'WARNING',
  JSON_OBJECT('line_spacing', 1.5),
  '检测正文是否为 1.5 倍行距', 40, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'BODY_FIRST_INDENT', '首行缩进检测', 'PARAGRAPH', 'WARNING',
  JSON_OBJECT('first_line_indent_chars', 2),
  '检测正文首行是否缩进 2 字符', 50, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'HEADING_LEVEL_1', '一级标题格式检测', 'HEADING', 'ERROR',
  JSON_OBJECT('font_name', '黑体', 'font_size_pt', 16, 'bold', true, 'align', 'center'),
  '检测一级标题字体、字号、加粗和居中', 60, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'HEADING_LEVEL_2', '二级标题格式检测', 'HEADING', 'WARNING',
  JSON_OBJECT('font_name', '黑体', 'font_size_pt', 14, 'bold', true, 'align', 'left'),
  '检测二级标题格式', 70, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'HEADING_LEVEL_3', '三级标题格式检测', 'HEADING', 'WARNING',
  JSON_OBJECT('font_name', '黑体', 'font_size_pt', 12, 'bold', true, 'align', 'left'),
  '检测三级标题格式', 80, 1, NOW(), NOW()
),
(
  @template_id, NULL, 'REFERENCE_SEQ', '参考文献编号连续性检测', 'REFERENCE', 'ERROR',
  JSON_OBJECT('pattern', '^\\[[0-9]+\\]', 'continuous', true),
  '检测参考文献编号是否连续', 90, 1, NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  rule_name = VALUES(rule_name),
  rule_type = VALUES(rule_type),
  severity = VALUES(severity),
  rule_config = VALUES(rule_config),
  description = VALUES(description),
  order_no = VALUES(order_no),
  enabled = VALUES(enabled),
  updated_at = NOW();

-- =============================
-- 5) 系统日志示例
-- =============================
INSERT INTO system_log (
  user_id, log_type, module, action, target_type, target_id, request_id,
  ip_address, user_agent, level, message, detail_json, created_at
)
SELECT
  @admin_id, 'LOGIN', 'auth', 'login', 'user', CAST(@admin_id AS CHAR), 'seed-login-admin-001',
  '127.0.0.1', 'seed-script', 'INFO', '管理员登录成功',
  JSON_OBJECT('username', 'admin01', 'source', 'seed'), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM system_log WHERE request_id = 'seed-login-admin-001'
);

INSERT INTO system_log (
  user_id, log_type, module, action, target_type, target_id, request_id,
  ip_address, user_agent, level, message, detail_json, created_at
)
SELECT
  @user_id, 'UPLOAD', 'paper', 'upload_paper', 'paper', CAST(@paper_id AS CHAR), 'seed-upload-paper-001',
  '127.0.0.1', 'seed-script', 'INFO', '用户上传论文初稿',
  JSON_OBJECT('paper_id', @paper_id, 'file', 'seed_user01_paper_v1.docx'), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM system_log WHERE request_id = 'seed-upload-paper-001'
);

INSERT INTO system_log (
  user_id, log_type, module, action, target_type, target_id, request_id,
  ip_address, user_agent, level, message, detail_json, created_at
)
SELECT
  @user_id, 'DETECT', 'detect', 'detect_paper', 'paper', CAST(@paper_id AS CHAR), 'seed-detect-paper-001',
  '127.0.0.1', 'seed-script', 'INFO', '用户发起论文格式检测',
  JSON_OBJECT('paper_id', @paper_id, 'template_id', @template_id), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM system_log WHERE request_id = 'seed-detect-paper-001'
);

INSERT INTO system_log (
  user_id, log_type, module, action, target_type, target_id, request_id,
  ip_address, user_agent, level, message, detail_json, created_at
)
SELECT
  @admin_id, 'UPDATE', 'template', 'update_template', 'template', CAST(@template_id AS CHAR), 'seed-update-template-001',
  '127.0.0.1', 'seed-script', 'INFO', '管理员更新默认模板',
  JSON_OBJECT('template_id', @template_id, 'version', 'v1.0.0'), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM system_log WHERE request_id = 'seed-update-template-001'
);

COMMIT;

-- 校验输出
SELECT id, username, role, status FROM sys_user WHERE username IN ('user01', 'admin01');
SELECT id, template_name, version_no, is_default, status FROM format_template WHERE template_name = '默认论文模板' ORDER BY id DESC LIMIT 1;
SELECT COUNT(*) AS rule_count FROM format_rule WHERE template_id = @template_id;
SELECT id, original_name, stored_name, storage_path FROM file_record WHERE paper_id = @paper_id ORDER BY id DESC LIMIT 5;
SELECT COUNT(*) AS log_count FROM system_log WHERE request_id LIKE 'seed-%';
