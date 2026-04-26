-- Supabase seed data
-- WARNING: password_hash stores plain text for demo compatibility.

insert into public.sys_user (username, password_hash, role, real_name, email, phone, status)
values
  ('user01', 'user123456', 'USER', 'Demo User', 'user01@example.com', '13800000001', 1),
  ('admin01', 'admin123456', 'ADMIN', 'System Admin', 'admin01@example.com', '13800000002', 1)
on conflict (username) do update
set role = excluded.role,
    real_name = excluded.real_name,
    email = excluded.email,
    phone = excluded.phone,
    status = 1;

do $$
declare
  v_admin_id bigint;
  v_template_id bigint;
  v_generic_template_id bigint;
begin
  select id into v_admin_id from public.sys_user where username = 'admin01' limit 1;

  insert into public.format_template (template_name, description, scope, version_no, creator_id, is_default, status, published_at)
  values ('Default Template', 'Default thesis formatting template', 'SYSTEM', 'v1.0.0', v_admin_id, 1, 1, now())
  on conflict (template_name, version_no) do update
  set description = excluded.description,
      status = 1,
      is_default = 1;

  select id into v_template_id
  from public.format_template
  where template_name = 'Default Template' and version_no = 'v1.0.0'
  limit 1;

  delete from public.format_rule where template_id = v_template_id;
  insert into public.format_rule (template_id, rule_code, rule_name, rule_type, severity, rule_config, description, order_no, enabled)
  values
    (v_template_id, 'PAGE_MARGIN', 'Page Margin', 'PAGE', 'ERROR', '{"top_cm":2.8,"bottom_cm":2.8,"left_cm":3.0,"right_cm":2.6}', 'A4 page margin', 10, 1),
    (v_template_id, 'PAGE_SIZE', 'Page Size', 'PAGE', 'ERROR', '{"paper_width_cm":21.0,"paper_height_cm":29.7}', 'A4 paper size', 20, 1),
    (v_template_id, 'BODY_FONT', 'Body Font', 'PARAGRAPH', 'ERROR', '{"font_name":"SimSun"}', 'Body text font', 30, 1),
    (v_template_id, 'BODY_FONT_SIZE', 'Body Font Size', 'PARAGRAPH', 'ERROR', '{"font_size_pt":12}', 'Body text size', 40, 1),
    (v_template_id, 'BODY_LINE_SPACING', 'Body Line Spacing', 'PARAGRAPH', 'WARNING', '{"line_spacing":1.25}', 'Body line spacing', 50, 1),
    (v_template_id, 'BODY_FIRST_INDENT', 'Body First Indent', 'PARAGRAPH', 'WARNING', '{"first_line_indent_chars":2}', 'Body first line indent', 60, 1),
    (v_template_id, 'BODY_ALIGNMENT', 'Body Alignment', 'PARAGRAPH', 'INFO', '{"align":"justify"}', 'Body alignment', 62, 1),
    (v_template_id, 'BODY_PARAGRAPH_SPACING', 'Body Paragraph Spacing', 'PARAGRAPH', 'INFO', '{"space_before_pt":0,"space_after_pt":0}', 'Body paragraph spacing', 65, 1),
    (v_template_id, 'HEADING_LEVEL_1', 'Heading Level 1', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":15,"bold":true,"align":"center"}', 'Level-1 heading format', 70, 1),
    (v_template_id, 'HEADING_LEVEL_2', 'Heading Level 2', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":14,"bold":true,"align":"left"}', 'Level-2 heading format', 80, 1),
    (v_template_id, 'HEADING_LEVEL_3', 'Heading Level 3', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":14,"bold":true,"align":"left"}', 'Level-3 heading format', 90, 1),
    (v_template_id, 'ABSTRACT_ZH_TITLE', 'Abstract Zh Title', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":16,"bold":true,"align":"center"}', 'Chinese abstract title format', 91, 1),
    (v_template_id, 'ABSTRACT_EN_TITLE', 'Abstract En Title', 'HEADING', 'ERROR', '{"font_name":"Times New Roman","font_size_pt":16,"bold":true,"align":"center"}', 'English abstract title format', 92, 1),
    (v_template_id, 'CONCLUSION_TITLE', 'Conclusion Title', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":16,"bold":true,"align":"center"}', 'Conclusion title format', 95, 1),
    (v_template_id, 'THANKS_TITLE', 'Thanks Title', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":16,"bold":true,"align":"center"}', 'Acknowledgement title format', 96, 1),
    (v_template_id, 'REFERENCE_TITLE', 'Reference Title', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":16,"bold":true,"align":"left"}', 'Reference title format', 97, 1),
    (v_template_id, 'APPENDIX_TITLE', 'Appendix Title', 'HEADING', 'ERROR', '{"font_name":"SimHei","font_size_pt":16,"bold":true,"align":"left"}', 'Appendix title format', 98, 1),
    (v_template_id, 'HEADING_NUMBER', 'Heading Numbering', 'HEADING', 'ERROR', '{"check_number_continuity":true,"check_hierarchy":true}', 'Heading numbering hierarchy and continuity', 100, 1),
    (v_template_id, 'TOC_CHECK', 'Table of Contents', 'HEADING', 'WARNING', '{"require_auto_toc":true,"max_level":3,"require_page_number":true}', 'TOC auto field and page number check', 110, 1),
    (v_template_id, 'SECTION_BREAK', 'Section Break', 'PAGE', 'WARNING', '{"max_sections":1,"chapters_start_new_page":true}', 'Section/page break check', 115, 1),
    (v_template_id, 'PAGE_NUMBER', 'Page Number', 'PAGE', 'WARNING', '{"position":"bottom_center","format":"arabic","start_from_body":true}', 'Page number format and position', 120, 1),
    (v_template_id, 'HEADER_FOOTER', 'Header Footer', 'PAGE', 'WARNING', '{"require_header":true,"require_footer":true,"start_from_body":true}', 'Header/footer presence', 130, 1),
    (v_template_id, 'FIGURE_TABLE', 'Figure Table', 'TABLE', 'WARNING', '{"check_image_center":true,"figure_prefix":"FIG","table_prefix":"TAB","figure_caption_position":"below","table_caption_position":"above","check_caption_position":true,"check_number_continuity":true}', 'Figure/table caption and numbering', 140, 1),
    (v_template_id, 'REFERENCE_SEQ', 'Reference Sequence', 'REFERENCE', 'ERROR', '{"continuous":true,"format":"[n]"}', 'Reference numbering continuity', 150, 1),
    (v_template_id, 'REFERENCE_FORMAT', 'Reference Format', 'REFERENCE', 'WARNING', '{"check_completeness":true,"check_type_mark":true,"check_punctuation":true}', 'Reference formatting checks', 160, 1),
    (v_template_id, 'COVER_INFO', 'Cover Info', 'CUSTOM', 'INFO', '{"require_class_name":false,"require_college":false,"require_major":false,"require_student_name":true,"require_student_no":true,"require_supervisor_1":true}', 'Cover-page required fields', 170, 1);

  -- Generic thesis template (non-default): clone rules from default template
  insert into public.format_template (template_name, description, scope, version_no, creator_id, is_default, status, published_at)
  values ('论文通用模板', '基于1.docx识别生成的论文通用格式模板', 'SYSTEM', 'v1.0.0', v_admin_id, 0, 1, now())
  on conflict (template_name, version_no) do update
  set description = excluded.description,
      status = 1,
      is_default = 0;

  select id into v_generic_template_id
  from public.format_template
  where template_name = '论文通用模板' and version_no = 'v1.0.0'
  limit 1;

  delete from public.format_rule where template_id = v_generic_template_id;
  insert into public.format_rule (
    template_id, rule_code, rule_name, rule_type, severity, rule_config, description, order_no, enabled
  )
  select
    v_generic_template_id, rule_code, rule_name, rule_type, severity, rule_config, description, order_no, enabled
  from public.format_rule
  where template_id = v_template_id;
end $$;
