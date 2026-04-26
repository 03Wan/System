SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS thesis_check_system
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE thesis_check_system;

DROP TABLE IF EXISTS system_log;
DROP TABLE IF EXISTS detection_result;
DROP TABLE IF EXISTS detection_task;
DROP TABLE IF EXISTS format_rule;
DROP TABLE IF EXISTS format_template;
DROP TABLE IF EXISTS file_record;
DROP TABLE IF EXISTS paper;
DROP TABLE IF EXISTS sys_user;

CREATE TABLE sys_user (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  username          VARCHAR(64) NOT NULL COMMENT '登录用户名',
  password_hash     VARCHAR(255) NOT NULL COMMENT '密码哈希',
  role              ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' COMMENT '角色',
  real_name         VARCHAR(64) NULL COMMENT '真实姓名',
  email             VARCHAR(128) NULL COMMENT '邮箱',
  phone             VARCHAR(32) NULL COMMENT '手机号',
  status            TINYINT NOT NULL DEFAULT 1 COMMENT '状态:1启用,0禁用',
  last_login_at     DATETIME NULL COMMENT '最后登录时间',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at        DATETIME NULL COMMENT '软删除时间',
  UNIQUE KEY uk_sys_user_username (username),
  UNIQUE KEY uk_sys_user_email (email),
  UNIQUE KEY uk_sys_user_phone (phone),
  KEY idx_sys_user_role_status (role, status),
  KEY idx_sys_user_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE paper (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  author_id         BIGINT UNSIGNED NOT NULL COMMENT '作者用户ID',
  title             VARCHAR(255) NOT NULL COMMENT '论文标题',
  abstract_text     TEXT NULL COMMENT '摘要',
  keywords          VARCHAR(512) NULL COMMENT '关键词(逗号分隔)',
  status            ENUM('DRAFT','SUBMITTED','ARCHIVED') NOT NULL DEFAULT 'DRAFT' COMMENT '论文状态',
  current_version   INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '当前版本号',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at        DATETIME NULL COMMENT '软删除时间',
  CONSTRAINT fk_paper_author
    FOREIGN KEY (author_id) REFERENCES sys_user(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  KEY idx_paper_author (author_id),
  KEY idx_paper_status (status),
  KEY idx_paper_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='论文表';

CREATE TABLE file_record (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  uploader_id       BIGINT UNSIGNED NOT NULL COMMENT '上传人ID',
  paper_id          BIGINT UNSIGNED NULL COMMENT '关联论文ID',
  file_type         ENUM('PAPER_ORIGINAL','PAPER_PROCESSED','TEMPLATE','RESULT_REPORT','OTHER') NOT NULL DEFAULT 'OTHER' COMMENT '文件类型',
  biz_ref_type      VARCHAR(64) NULL COMMENT '业务引用类型(如TASK/RESULT/TEMPLATE)',
  biz_ref_id        BIGINT UNSIGNED NULL COMMENT '业务引用ID',
  original_name     VARCHAR(255) NOT NULL COMMENT '原始文件名',
  stored_name       VARCHAR(255) NOT NULL COMMENT '存储文件名',
  storage_path      VARCHAR(500) NOT NULL COMMENT '存储路径',
  file_ext          VARCHAR(20) NULL COMMENT '扩展名',
  mime_type         VARCHAR(128) NULL COMMENT 'MIME类型',
  file_size         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小(字节)',
  md5               CHAR(32) NULL COMMENT '文件MD5',
  is_deleted        TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除:1是0否',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  CONSTRAINT fk_file_record_uploader
    FOREIGN KEY (uploader_id) REFERENCES sys_user(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_file_record_paper
    FOREIGN KEY (paper_id) REFERENCES paper(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  UNIQUE KEY uk_file_record_stored_name (stored_name),
  KEY idx_file_record_uploader (uploader_id),
  KEY idx_file_record_paper (paper_id),
  KEY idx_file_record_type (file_type),
  KEY idx_file_record_md5 (md5),
  KEY idx_file_record_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件记录表';

CREATE TABLE format_template (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  template_name     VARCHAR(128) NOT NULL COMMENT '模板名称',
  description       VARCHAR(500) NULL COMMENT '模板说明',
  scope             ENUM('SYSTEM','PERSONAL') NOT NULL DEFAULT 'SYSTEM' COMMENT '模板范围',
  version_no        VARCHAR(32) NOT NULL DEFAULT 'v1.0.0' COMMENT '模板版本',
  template_file_id  BIGINT UNSIGNED NULL COMMENT '模板文件ID(file_record)',
  creator_id        BIGINT UNSIGNED NOT NULL COMMENT '创建人ID',
  is_default        TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认模板',
  status            TINYINT NOT NULL DEFAULT 1 COMMENT '状态:1启用,0禁用',
  published_at      DATETIME NULL COMMENT '发布时间',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  CONSTRAINT fk_format_template_file
    FOREIGN KEY (template_file_id) REFERENCES file_record(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT fk_format_template_creator
    FOREIGN KEY (creator_id) REFERENCES sys_user(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE KEY uk_format_template_name_version (template_name, version_no),
  KEY idx_format_template_scope_status (scope, status),
  KEY idx_format_template_creator (creator_id),
  KEY idx_format_template_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='格式模板表';

CREATE TABLE format_rule (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  template_id       BIGINT UNSIGNED NOT NULL COMMENT '模板ID',
  parent_rule_id    BIGINT UNSIGNED NULL COMMENT '父规则ID(支持树形)',
  rule_code         VARCHAR(64) NOT NULL COMMENT '规则编码(模板内唯一)',
  rule_name         VARCHAR(128) NOT NULL COMMENT '规则名称',
  rule_type         ENUM('PARAGRAPH','FONT','HEADING','PAGE','TABLE','REFERENCE','CUSTOM') NOT NULL DEFAULT 'CUSTOM' COMMENT '规则类型',
  severity          ENUM('ERROR','WARNING','INFO') NOT NULL DEFAULT 'ERROR' COMMENT '严重级别',
  rule_config       JSON NOT NULL COMMENT '规则配置JSON',
  description       VARCHAR(500) NULL COMMENT '规则说明',
  order_no          INT NOT NULL DEFAULT 0 COMMENT '排序号',
  enabled           TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  CONSTRAINT fk_format_rule_template
    FOREIGN KEY (template_id) REFERENCES format_template(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_format_rule_parent
    FOREIGN KEY (parent_rule_id) REFERENCES format_rule(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  UNIQUE KEY uk_format_rule_template_code (template_id, rule_code),
  KEY idx_format_rule_template (template_id),
  KEY idx_format_rule_type (rule_type),
  KEY idx_format_rule_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='格式规则表';

CREATE TABLE detection_task (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  task_no           VARCHAR(64) NOT NULL COMMENT '任务编号',
  paper_id          BIGINT UNSIGNED NOT NULL COMMENT '论文ID',
  submitter_id      BIGINT UNSIGNED NOT NULL COMMENT '提交人ID',
  template_id       BIGINT UNSIGNED NOT NULL COMMENT '使用模板ID',
  source_file_id    BIGINT UNSIGNED NOT NULL COMMENT '源文件ID(file_record)',
  task_type         ENUM('FORMAT_CHECK','FULL_CHECK') NOT NULL DEFAULT 'FORMAT_CHECK' COMMENT '任务类型',
  status            ENUM('PENDING','RUNNING','SUCCESS','FAILED','CANCELED') NOT NULL DEFAULT 'PENDING' COMMENT '任务状态',
  priority          TINYINT NOT NULL DEFAULT 5 COMMENT '优先级(1高-9低)',
  progress          TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '进度0-100',
  queued_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入队时间',
  started_at        DATETIME NULL COMMENT '开始时间',
  finished_at       DATETIME NULL COMMENT '结束时间',
  worker_node       VARCHAR(128) NULL COMMENT '处理节点标识',
  error_message     VARCHAR(1000) NULL COMMENT '失败错误信息',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  CONSTRAINT fk_detection_task_paper
    FOREIGN KEY (paper_id) REFERENCES paper(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_detection_task_submitter
    FOREIGN KEY (submitter_id) REFERENCES sys_user(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_detection_task_template
    FOREIGN KEY (template_id) REFERENCES format_template(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_detection_task_source_file
    FOREIGN KEY (source_file_id) REFERENCES file_record(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE KEY uk_detection_task_no (task_no),
  KEY idx_detection_task_paper (paper_id),
  KEY idx_detection_task_submitter (submitter_id),
  KEY idx_detection_task_status (status),
  KEY idx_detection_task_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='检测任务表';

CREATE TABLE detection_result (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  task_id           BIGINT UNSIGNED NOT NULL COMMENT '任务ID',
  total_score       DECIMAL(6,2) NULL COMMENT '总分',
  pass_flag         TINYINT NOT NULL DEFAULT 0 COMMENT '是否通过:1通过,0未通过',
  error_count       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '错误数',
  warning_count     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '警告数',
  info_count        INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '提示数',
  hit_rule_count    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '命中规则数',
  summary_json      JSON NULL COMMENT '结果摘要JSON',
  detail_json       JSON NULL COMMENT '详细结果JSON',
  report_file_id    BIGINT UNSIGNED NULL COMMENT '报告文件ID(file_record)',
  completed_at      DATETIME NULL COMMENT '完成时间',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  CONSTRAINT fk_detection_result_task
    FOREIGN KEY (task_id) REFERENCES detection_task(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_detection_result_report_file
    FOREIGN KEY (report_file_id) REFERENCES file_record(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  UNIQUE KEY uk_detection_result_task (task_id),
  KEY idx_detection_result_pass (pass_flag),
  KEY idx_detection_result_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='检测结果表';

CREATE TABLE system_log (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  user_id           BIGINT UNSIGNED NULL COMMENT '操作用户ID(系统操作可为空)',
  log_type          ENUM('LOGIN','LOGOUT','CREATE','UPDATE','DELETE','UPLOAD','DOWNLOAD','DETECT','SYSTEM','SECURITY') NOT NULL DEFAULT 'SYSTEM' COMMENT '日志类型',
  module            VARCHAR(64) NOT NULL COMMENT '模块名',
  action            VARCHAR(128) NOT NULL COMMENT '动作',
  target_type       VARCHAR(64) NULL COMMENT '目标类型',
  target_id         VARCHAR(64) NULL COMMENT '目标ID',
  request_id        VARCHAR(64) NULL COMMENT '请求ID',
  ip_address        VARCHAR(45) NULL COMMENT 'IP地址(IPv4/IPv6)',
  user_agent        VARCHAR(500) NULL COMMENT '客户端UA',
  level             ENUM('INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO' COMMENT '日志级别',
  message           VARCHAR(1000) NULL COMMENT '简要消息',
  detail_json       JSON NULL COMMENT '详细内容JSON',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  CONSTRAINT fk_system_log_user
    FOREIGN KEY (user_id) REFERENCES sys_user(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  KEY idx_system_log_user (user_id),
  KEY idx_system_log_type_level (log_type, level),
  KEY idx_system_log_module_action (module, action),
  KEY idx_system_log_created_at (created_at),
  KEY idx_system_log_request_id (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统日志表';

SET FOREIGN_KEY_CHECKS = 1;
