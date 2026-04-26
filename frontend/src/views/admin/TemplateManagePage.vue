<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">模板管理</h2>
        <div class="page-sub">所有规则参数均可视化编辑：布尔值为开关，数值为数字输入，文本为输入框；常用字段自动提供下拉选项。</div>
      </div>
    </div>

    <el-card class="card panel-pad">
      <el-row :gutter="10" class="mini-metrics">
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="模板总数" :value="rows.length" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="系统模板" :value="systemTemplateCount" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="启用模板" :value="enabledTemplateCount" /></el-col>
      </el-row>

      <div class="toolbar">
        <el-input v-model="keyword" clearable placeholder="按模板名称搜索" style="max-width: 280px" />
        <el-button type="primary" @click="openCreate">新建模板</el-button>
        <el-button :loading="loading" @click="loadTemplates">刷新</el-button>
      </div>

      <div class="table-wrap">
        <el-table :data="filteredRows" border stripe max-height="720">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="template_name" label="模板名称" min-width="180" />
          <el-table-column prop="version_no" label="版本" width="120" />
          <el-table-column prop="scope" label="范围" width="100" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">{{ row.status === 1 ? "启用" : "禁用" }}</template>
          </el-table-column>
          <el-table-column label="操作" width="340">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="success" @click="openRules(row)">规则配置</el-button>
              <el-button link type="danger" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="!filteredRows.length" class="empty-wrap" style="margin-top: 10px">
        <el-empty description="暂无模板，建议先创建一个检测模板" :image-size="66" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑模板' : '新建模板'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="模板名称"><el-input v-model="form.template_name" /></el-form-item>
        <el-form-item label="模板描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="form.version_no" /></el-form-item>
        <el-form-item label="范围">
          <el-select v-model="form.scope" style="width: 100%">
            <el-option label="系统" value="SYSTEM" />
            <el-option label="个人" value="PERSONAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态"><el-switch v-model="statusBool" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rulesDialogVisible" :title="`规则配置 - ${currentTemplateName}`" width="1240px">
      <el-alert
        type="info"
        :closable="false"
        title="参数可视化说明：布尔值=开关，数字=数字输入，文本=输入框；常用字段自动显示下拉可选项。"
        style="margin-bottom: 12px"
      />

      <div class="table-wrap">
        <el-table :data="ruleRows" border stripe max-height="620">
          <el-table-column label="启用" width="72">
            <template #default="{ row }"><el-switch v-model="row.enabledBool" /></template>
          </el-table-column>

          <el-table-column label="规则编码" min-width="190">
            <template #default="{ row }">
              <div class="rule-code-cell">
                <span>{{ displayRuleCodeZh(row.rule_code) }}</span>
                <span class="rule-code-raw">{{ row.rule_code }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="规则名称" min-width="170">
            <template #default="{ row }">{{ displayRuleNameZh(row) }}</template>
          </el-table-column>

          <el-table-column label="级别" width="130">
            <template #default="{ row }">
              <el-select v-model="row.severity" style="width: 110px">
                <el-option label="错误" value="ERROR" />
                <el-option label="警告" value="WARNING" />
                <el-option label="提示" value="INFO" />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column label="参数配置（通用可视化）" min-width="680">
            <template #default="{ row }">
              <div class="rule-controls">
                <template v-for="entry in getRuleEntries(row)" :key="`${row.rule_code}-${entry.key}`">
                  <span class="param-label">{{ keyLabel(entry.key) }}</span>

                  <template v-if="entry.type === 'bool'">
                    <el-switch v-model="row.ui[entry.key]" />
                  </template>

                  <template v-else-if="entry.type === 'number'">
                    <el-input-number
                      v-model="row.ui[entry.key]"
                      :step="numberStep(entry.key)"
                      :min="numberMin(entry.key)"
                      :max="numberMax(entry.key)"
                    />
                  </template>

                  <template v-else-if="entry.type === 'select'">
                    <el-select
                      v-model="row.ui[entry.key]"
                      filterable
                      allow-create
                      default-first-option
                      style="width: 170px"
                    >
                      <el-option
                        v-for="opt in selectOptions(entry.key, row.rule_code)"
                        :key="`${entry.key}-${String(opt.value)}`"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </template>

                  <template v-else>
                    <el-input v-model="row.ui[entry.key]" style="width: 170px" />
                  </template>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="rulesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="rulesSaving" @click="saveRules">保存规则</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createTemplateApi,
  deleteTemplateApi,
  getTemplateRulesApi,
  getTemplatesApi,
  saveTemplateRulesApi,
  updateTemplateApi
} from "../../api/admin";

const loading = ref(false);
const rows = ref([]);
const keyword = ref("");

const dialogVisible = ref(false);
const rulesDialogVisible = ref(false);
const rulesSaving = ref(false);

const currentTemplateId = ref(null);
const currentTemplateName = ref("");
const ruleRows = ref([]);

const form = reactive({
  id: null,
  template_name: "",
  description: "",
  version_no: "v1.0.0",
  scope: "SYSTEM",
  status: 1
});

const statusBool = computed({
  get: () => form.status === 1,
  set: (v) => {
    form.status = v ? 1 : 0;
  }
});

const filteredRows = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return rows.value.filter((r) => !key || r.template_name?.toLowerCase().includes(key));
});

const systemTemplateCount = computed(() => rows.value.filter((r) => r.scope === "SYSTEM").length);
const enabledTemplateCount = computed(() => rows.value.filter((r) => r.status === 1).length);

onMounted(() => {
  loadTemplates();
});

async function loadTemplates() {
  loading.value = true;
  try {
    const res = await getTemplatesApi();
    rows.value = res?.data?.list || [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, {
    id: null,
    template_name: "",
    description: "",
    version_no: "v1.0.0",
    scope: "SYSTEM",
    status: 1
  });
  dialogVisible.value = true;
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    template_name: row.template_name,
    description: row.description || "",
    version_no: row.version_no || "v1.0.0",
    scope: row.scope || "SYSTEM",
    status: row.status ?? 1
  });
  dialogVisible.value = true;
}

async function save() {
  try {
    if (form.id) {
      await updateTemplateApi(form.id, form);
    } else {
      await createTemplateApi(form);
    }
    ElMessage.success("保存成功");
    dialogVisible.value = false;
    loadTemplates();
  } catch (error) {
    ElMessage.error(error?.message || "保存失败");
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除模板 ${row.template_name} 吗？`, "提示", { type: "warning" });
  await deleteTemplateApi(row.id);
  ElMessage.success("删除成功");
  loadTemplates();
}

function normalizeRuleUI(rule) {
  const cfg = rule.rule_config || {};
  return { ...cfg };
}

async function openRules(row) {
  currentTemplateId.value = row.id;
  currentTemplateName.value = row.template_name;
  const res = await getTemplateRulesApi(row.id);
  const list = res?.data?.list || [];
  ruleRows.value = list.map((r) => ({
    ...r,
    enabledBool: r.enabled === 1,
    ui: normalizeRuleUI(r)
  }));
  rulesDialogVisible.value = true;
}

function getRuleEntries(row) {
  const ui = row.ui || {};
  return Object.keys(ui).map((key) => {
    const val = ui[key];
    let type = typeof val === "boolean" ? "bool" : typeof val === "number" ? "number" : "string";
    if (selectOptions(key, row.rule_code).length > 0) {
      type = "select";
    }
    return { key, type };
  });
}

function selectOptions(key, ruleCode = "") {
  const code = String(ruleCode || "").toUpperCase();

  if (key.endsWith("font_size_pt")) {
    return [
      { label: "初号 (42pt)", value: 42 },
      { label: "小初 (36pt)", value: 36 },
      { label: "一号 (26pt)", value: 26 },
      { label: "小一 (24pt)", value: 24 },
      { label: "二号 (22pt)", value: 22 },
      { label: "小二 (18pt)", value: 18 },
      { label: "三号 (16pt)", value: 16 },
      { label: "小三 (15pt)", value: 15 },
      { label: "四号 (14pt)", value: 14 },
      { label: "小四 (12pt)", value: 12 },
      { label: "五号 (10.5pt)", value: 10.5 },
      { label: "小五 (9pt)", value: 9 },
      { label: "六号 (7.5pt)", value: 7.5 },
      { label: "小六 (6.5pt)", value: 6.5 },
      { label: "七号 (5.5pt)", value: 5.5 },
      { label: "八号 (5pt)", value: 5 }
    ];
  }

  if (key.endsWith("font_name") || key === "font_cn_name" || key === "font_en_name") {
    return [
      { label: "宋体", value: "宋体" },
      { label: "黑体", value: "黑体" },
      { label: "仿宋", value: "仿宋" },
      { label: "楷体", value: "楷体" },
      { label: "微软雅黑", value: "微软雅黑" },
      { label: "Arial", value: "Arial" },
      { label: "Calibri", value: "Calibri" },
      { label: "Times New Roman", value: "Times New Roman" }
    ];
  }

  if (key.endsWith("caption_position")) {
    return [
      { label: "上方", value: "above" },
      { label: "下方", value: "below" }
    ];
  }

  if (key === "format") {
    if (code === "REFERENCE_SEQ") {
      return [
        { label: "[n]", value: "[n]" },
        { label: "n.", value: "n." },
        { label: "n、", value: "n、" }
      ];
    }
    if (code === "PAGE_NUMBER") {
      return [
        { label: "阿拉伯数字", value: "arabic" },
        { label: "罗马数字", value: "roman" }
      ];
    }
  }

  const map = {
    paper_name: [
      { label: "A4", value: "A4" },
      { label: "A3", value: "A3" },
      { label: "B5", value: "B5" },
      { label: "B4", value: "B4" }
    ],
    align: [
      { label: "左对齐", value: "left" },
      { label: "居中", value: "center" },
      { label: "右对齐", value: "right" },
      { label: "两端对齐", value: "justify" }
    ],
    position: [
      { label: "底部居中", value: "bottom_center" },
      { label: "底部左侧", value: "bottom_left" },
      { label: "底部右侧", value: "bottom_right" },
      { label: "顶部居中", value: "top_center" },
      { label: "顶部左侧", value: "top_left" },
      { label: "顶部右侧", value: "top_right" }
    ],
    style: [
      { label: "GB/T 7714", value: "GBT7714" },
      { label: "APA", value: "APA" },
      { label: "MLA", value: "MLA" },
      { label: "IEEE", value: "IEEE" }
    ],
    title: [
      { label: "摘要", value: "摘要" },
      { label: "Abstract", value: "Abstract" },
      { label: "结论", value: "结论" },
      { label: "致谢", value: "致谢" },
      { label: "参考文献", value: "参考文献" },
      { label: "附录", value: "附录" }
    ],
    prefix: [
      { label: "关键词", value: "关键词" },
      { label: "Key words", value: "Key words" },
      { label: "图", value: "图" },
      { label: "表", value: "表" }
    ],
    figure_prefix: [
      { label: "图", value: "图" },
      { label: "Figure", value: "Figure" }
    ],
    table_prefix: [
      { label: "表", value: "表" },
      { label: "Table", value: "Table" }
    ],
    index_style: [
      { label: "阿拉伯数字", value: "arabic" },
      { label: "中文数字", value: "chinese" },
      { label: "罗马数字", value: "roman" }
    ],
    cell_vertical_align: [
      { label: "顶部", value: "top" },
      { label: "居中", value: "center" },
      { label: "底部", value: "bottom" }
    ]
  };
  return map[key] || [];
}

function keyLabel(key) {
  const dict = {
    top_cm: "上边距(cm)",
    bottom_cm: "下边距(cm)",
    left_cm: "左边距(cm)",
    right_cm: "右边距(cm)",
    paper_width_cm: "纸张宽(cm)",
    paper_height_cm: "纸张高(cm)",
    paper_name: "纸张名称",

    font_name: "字体",
    font_size_pt: "字号(pt)",
    font_cn_name: "中文字体",
    font_en_name: "西文字体",
    line_spacing: "行距",
    align: "对齐方式",
    bold: "加粗",
    first_line_indent_chars: "首行缩进(字符)",
    left_indent_chars: "左缩进(字符)",
    hanging_indent_chars: "悬挂缩进(字符)",
    space_before_pt: "段前(pt)",
    space_after_pt: "段后(pt)",

    position: "位置",
    format: "格式",
    style: "样式",
    continuous: "连续编号",
    max_sections: "最大分节数",
    max_level: "最大层级",

    require_header: "要求页眉",
    require_footer: "要求页脚",
    require_page_number: "要求页码",
    require_auto_toc: "要求自动目录",

    check_caption_position: "检查题注位置",
    check_number_continuity: "检查编号连续",
    check_image_center: "检查图片居中",
    check_completeness: "检查完整性",
    check_type_mark: "检查文献类型标识",
    check_punctuation: "检查标点规范",
    check_mixed_punctuation: "检查中英标点混用",
    check_hierarchy: "检查层级跳级",

    title: "标题文本",
    title_text: "标题文本",
    title_prefix: "标题前缀",
    prefix: "前缀",
    prefix_bold: "前缀加粗",
    prefix_font_name: "前缀字体",

    min_count: "最小数量",
    max_count: "最大数量",
    strict: "严格模式",
    min_dpi: "最小DPI",
    repeat_header: "跨页重复表头",
    chapters_start_new_page: "章节另起页",

    max_continuous_blank_lines: "最大连续空行",
    forbid_end_punctuation: "禁止标题末尾标点",
    exclude_sections_csv: "排除章节(逗号分隔)",
    start_from_body: "从正文开始",

    require_title: "要求题名",
    require_author: "要求作者",
    require_school: "要求学校",
    require_college: "要求学院",
    require_class_name: "要求班级",
    require_major: "要求专业",
    require_student_name: "要求学生姓名",
    require_student_no: "要求学号",
    require_supervisor_1: "要求导师1",
    require_supervisor_2: "要求导师2",
    require_date: "要求日期",

    require_abstract: "要求摘要",
    require_keywords: "要求关键词",
    require_references: "要求参考文献",
    require_appendix_title: "要求附录标题",
    require_section: "要求章节存在",

    caption_font_name: "题注字体",
    caption_font_size_pt: "题注字号(pt)",
    content_font_name: "内容字体",
    content_font_size_pt: "内容字号(pt)",
    figure_caption_position: "图片题注位置",
    table_caption_position: "表格题注位置",
    figure_prefix: "图片前缀",
    table_prefix: "表格前缀",
    image_center: "图片居中",

    row_height_cm: "行高(cm)",
    cell_vertical_align: "单元格垂直对齐",
    blank_line_after_title: "标题后空行",
    blank_line_before_after: "前后空行",
    blank_line_after_figure: "图片后空行",

    index_style: "序号样式",
    hanging_align_after_index: "序号后悬挂对齐",
    type_marks_csv: "类型标识列表",
    example: "示例",
    example_text: "示例文本",
    standard: "检测标准"
  };
  return dict[key] || key;
}

function displayRuleNameZh(row) {
  const name = String(row?.rule_name || "").trim();
  if (name && /[\u4e00-\u9fff]/.test(name)) return name;
  return displayRuleCodeZh(row?.rule_code || "") || name || row?.rule_code || "未命名规则";
}

function displayRuleCodeZh(ruleCode) {
  const code = String(ruleCode || "").trim().toUpperCase();
  const byCode = {
    PAGE_MARGIN: "页边距",
    PAGE_SIZE: "纸张大小",
    BODY_FONT: "正文字体",
    BODY_FONT_SIZE: "正文字号",
    BODY_LINE_SPACING: "正文行距",
    BODY_ALIGNMENT: "正文对齐",
    BODY_FIRST_INDENT: "正文首行缩进",
    BODY_PARAGRAPH_SPACING: "正文段前段后",
    SECTION_BREAK: "章节另起页",

    HEADING_LEVEL_1: "一级标题格式",
    HEADING_LEVEL_2: "二级标题格式",
    HEADING_LEVEL_3: "三级标题格式",
    HEADING_NUMBER: "标题编号与层级",

    HEADER_FOOTER: "页眉页脚",
    PAGE_NUMBER: "页码",
    TOC_CHECK: "目录检查",
    FIGURE_TABLE: "图表编号与位置",

    REFERENCE_SEQ: "参考文献编号连续性",
    REFERENCE_FORMAT: "参考文献格式",
    COVER_INFO: "封面信息完整性",

    ABSTRACT_ZH_TITLE: "中文摘要标题",
    ABSTRACT_EN_TITLE: "英文摘要标题",
    CONCLUSION_TITLE: "结论标题",
    THANKS_TITLE: "致谢标题",
    REFERENCE_TITLE: "参考文献标题",
    APPENDIX_TITLE: "附录标题"
  };
  return byCode[code] || code || "未命名规则";
}

function numberStep(key) {
  if (["top_cm", "bottom_cm", "left_cm", "right_cm", "paper_width_cm", "paper_height_cm", "row_height_cm"].includes(key)) {
    return 0.1;
  }
  if (["line_spacing"].includes(key)) {
    return 0.25;
  }
  return 1;
}

function numberMin(key) {
  if (["line_spacing"].includes(key)) return 0.5;
  if (key.includes("_cm")) return 0;
  if (key.includes("pt")) return 0;
  return 0;
}

function numberMax(key) {
  if (["line_spacing"].includes(key)) return 4;
  if (["paper_width_cm", "paper_height_cm"].includes(key)) return 100;
  if (key.includes("_cm")) return 20;
  if (key.includes("pt")) return 100;
  return 10000;
}

function buildRuleConfig(rule) {
  return { ...(rule.ui || {}) };
}

async function saveRules() {
  if (!currentTemplateId.value) return;
  rulesSaving.value = true;
  try {
    const payload = ruleRows.value.map((r) => ({
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      rule_type: r.rule_type,
      severity: r.severity,
      rule_config: buildRuleConfig(r),
      description: r.description,
      order_no: r.order_no,
      enabled: r.enabledBool ? 1 : 0
    }));
    await saveTemplateRulesApi(currentTemplateId.value, payload);
    ElMessage.success("规则保存成功");
    rulesDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(error?.message || "规则保存失败");
  } finally {
    rulesSaving.value = false;
  }
}
</script>

<style scoped>
.mini-metrics {
  margin-bottom: 10px;
  padding: 2px 2px 10px;
}

.rule-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  row-gap: 12px;
}

.param-label {
  font-size: 12px;
  color: var(--muted);
}

.table-wrap {
  border-radius: 14px;
  overflow: hidden;
}

.table-wrap :deep(.el-table__body-wrapper) {
  max-height: 620px;
}

.rule-code-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 4px;
}

.rule-code-raw {
  color: var(--muted);
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;
}

.rule-controls :deep(.el-input-number),
.rule-controls :deep(.el-select),
.rule-controls :deep(.el-input) {
  max-width: 180px;
}

:deep(.el-dialog) {
  background: var(--surface, #ffffff);
  color: var(--text, #1f2937);
}

:deep(.el-dialog__title),
:deep(.el-table th),
:deep(.el-form-item__label) {
  color: var(--text, #1f2937);
}

:deep(.el-table),
:deep(.el-table tr),
:deep(.el-table th.el-table__cell),
:deep(.el-table td.el-table__cell) {
  background: var(--surface, #ffffff);
  color: var(--text, #1f2937);
}

:deep(.el-alert--info) {
  background-color: color-mix(in srgb, var(--primary, #409eff) 10%, transparent);
  border-color: color-mix(in srgb, var(--primary, #409eff) 30%, transparent);
}
</style>
