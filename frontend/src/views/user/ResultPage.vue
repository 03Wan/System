<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">检测结果查询</h2>
        <div class="page-sub">输入任务 ID 查看评分、下载报告并筛选问题明细。</div>
      </div>
    </div>

    <el-card class="card panel-pad query-card">
      <div class="toolbar query-toolbar">
        <el-input v-model="taskId" placeholder="请输入任务ID" style="max-width: 300px" clearable @keyup.enter="loadResult" />
        <el-button type="primary" :loading="loading" @click="loadResult">查询结果</el-button>
      </div>
    </el-card>

    <template v-if="result">
      <el-row :gutter="12" style="margin-top: 12px">
        <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="总分" :value="result.total_score || 0" /></el-card></el-col>
        <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="错误" :value="result.error_count || 0" /></el-card></el-col>
        <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="警告" :value="result.warning_count || 0" /></el-card></el-col>
        <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="提示" :value="result.info_count || 0" /></el-card></el-col>
      </el-row>

      <el-card class="card panel-pad" style="margin-top: 12px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务编号">{{ result.task_no }}</el-descriptions-item>
          <el-descriptions-item label="文档ID">{{ result.paper_id }}</el-descriptions-item>
          <el-descriptions-item label="检测状态">{{ displayTaskStatus(result.status) }}</el-descriptions-item>
          <el-descriptions-item label="是否通过">
            <el-tag :type="result.pass_flag === 1 ? 'success' : 'danger'">{{ result.pass_flag === 1 ? "通过" : "未通过" }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-space style="margin-top: 10px">
          <el-button type="success" plain :loading="downloadingExcel" @click="downloadExcelReport">下载 Excel 报告</el-button>
          <span class="muted" v-if="result.completed_at">完成时间：{{ formatToBeijing(result.completed_at) }}</span>
        </el-space>
      </el-card>

      <el-card class="card panel-pad" style="margin-top: 12px">
        <div class="section-title">问题明细（{{ filteredIssues.length }}）</div>

        <div class="toolbar filter-toolbar">
          <el-select v-model="statusFilter" style="width: 200px">
            <el-option label="全部" value="ALL" />
            <el-option label="只看确定问题" value="confirmed" />
            <el-option label="只看疑似问题" value="suspected" />
            <el-option label="只看人工确认" value="manual_review" />
            <el-option label="只看支持一键修复" value="auto_fixable" />
          </el-select>
          <el-select v-model="severityFilter" style="width: 150px">
            <el-option label="全部级别" value="ALL" />
            <el-option label="错误" value="ERROR" />
            <el-option label="警告" value="WARNING" />
            <el-option label="提示" value="INFO" />
          </el-select>
          <el-input v-model="keyword" clearable placeholder="搜索类型/描述/位置/建议/原因" style="max-width: 320px" />
          <el-radio-group v-model="viewMode">
            <el-radio-button label="summary">汇总视图</el-radio-button>
            <el-radio-button label="detail">明细视图</el-radio-button>
          </el-radio-group>
          <el-select v-if="viewMode === 'summary'" v-model="summaryLimit" style="width: 140px">
            <el-option label="前 10 项" :value="10" />
            <el-option label="前 20 项" :value="20" />
            <el-option label="前 50 项" :value="50" />
            <el-option label="全部" :value="0" />
          </el-select>
        </div>

        <div class="group-header">
          <el-tag type="danger">确定问题 {{ groupedIssueMap.confirmed.length }}</el-tag>
          <el-tag type="warning">疑似问题 {{ groupedIssueMap.suspected.length }}</el-tag>
          <el-tag type="info">人工确认 {{ groupedIssueMap.manual_review.length }}</el-tag>
          <el-tag type="success">支持一键修复 {{ autoFixableCount }}</el-tag>
          <el-tag type="success">一键修复覆盖率 {{ autoFixCoveragePercent }}</el-tag>
        </div>

        <div v-if="viewMode === 'summary'" class="group-block">
          <div class="group-title">
            <span>问题类型汇总</span>
            <el-tag size="small">{{ issueSummaryRows.length }}</el-tag>
          </div>
          <el-table :data="limitedSummaryRows" border stripe max-height="520" class="issues-table">
            <el-table-column label="#" width="66">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="问题类型" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.typeLabel }}</template>
            </el-table-column>
            <el-table-column label="数量" width="90" align="center">
              <template #default="{ row }">{{ row.count }}</template>
            </el-table-column>
            <el-table-column label="占比" width="90" align="center">
              <template #default="{ row }">{{ row.ratio }}</template>
            </el-table-column>
            <el-table-column label="确定问题" width="100" align="center">
              <template #default="{ row }">{{ row.confirmed }}</template>
            </el-table-column>
            <el-table-column label="疑似问题" width="100" align="center">
              <template #default="{ row }">{{ row.suspected }}</template>
            </el-table-column>
            <el-table-column label="人工确认" width="100" align="center">
              <template #default="{ row }">{{ row.manual_review }}</template>
            </el-table-column>
            <el-table-column label="支持一键修复" width="120" align="center">
              <template #default="{ row }">{{ row.autoFixable }}</template>
            </el-table-column>
            <el-table-column label="示例建议" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sampleSuggestion }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="focusProblemType(row.problemType)">看明细</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else v-for="group in groupedOrder" :key="group.key" class="group-block">
          <div class="group-title">
            <span>{{ group.label }}</span>
            <el-tag size="small" :type="group.tagType">{{ groupedIssueMap[group.key].length }}</el-tag>
          </div>

          <el-table
            v-if="groupedIssueMap[group.key].length"
            :data="pagedGroupIssues(group.key)"
            border
            stripe
            max-height="420"
            class="issues-table"
          >
            <el-table-column label="#" width="66">
              <template #default="{ $index }">{{ groupStartIndex(group.key) + $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="问题类型" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ displayProblemType(row.problem_type) }}</template>
            </el-table-column>
            <el-table-column label="问题描述" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">{{ displayProblemDesc(row.problem_desc) }}</template>
            </el-table-column>
            <el-table-column label="位置" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ displayPosition(row) }}</template>
            </el-table-column>
            <el-table-column prop="severity" label="级别" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="severityTagType(row.severity)">{{ severityLabel(row.severity) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="置信度" width="100" align="center">
              <template #default="{ row }">{{ toPercent(row.confidence) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.normalizedStatus)">{{ statusLabel(row.normalizedStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="支持一键修复" width="140" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isAutoFixable ? 'success' : 'info'">{{ row.isAutoFixable ? "支持一键修复" : "需手动修改" }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="修正建议" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ displaySuggestion(row.suggestion) }}</template>
            </el-table-column>
            <el-table-column label="原因" min-width="240">
              <template #default="{ row }">
                <div v-if="row.reasons && row.reasons.length" class="reason-wrap">
                  <el-tag
                    v-for="(r, idx) in row.reasons.slice(0, 3)"
                    :key="`${row.problem_type}-${idx}-${r}`"
                    size="small"
                    effect="plain"
                  >
                    {{ displayReason(r) }}
                  </el-tag>
                  <el-tooltip v-if="row.reasons.length > 3" placement="top">
                    <template #content>{{ row.reasons.map(displayReason).join(' / ') }}</template>
                    <el-tag size="small" type="info">+{{ row.reasons.length - 3 }}</el-tag>
                  </el-tooltip>
                </div>
                <span v-else class="muted">-</span>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-else description="该分组暂无问题" :image-size="60" />

          <el-pagination
            v-if="groupedIssueMap[group.key].length"
            style="margin-top: 10px"
            background
            layout="total, prev, pager, next"
            :current-page="groupPages[group.key]"
            :page-size="pageSize"
            :total="groupedIssueMap[group.key].length"
            @current-change="(next) => onGroupPageChange(group.key, next)"
          />
        </div>
      </el-card>
    </template>

    <el-card v-else class="card panel-pad" style="margin-top: 12px">
      <div class="empty-wrap">
        <el-empty description="请输入任务 ID 并点击“查询结果”查看检测详情" :image-size="70" />
      </div>
      <div class="panel-sub" style="margin-top: 10px">
        建议从“历史记录”点击“查看结果”进入，可自动带入任务 ID。
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { downloadFileBlobApi, downloadReportExcelByTaskApi, getReportApi } from "../../api/paper";

const route = useRoute();
const loading = ref(false);
const downloadingExcel = ref(false);
const taskId = ref("");
const result = ref(null);
const issues = ref([]);

const statusFilter = ref("ALL");
const severityFilter = ref("ALL");
const keyword = ref("");
const viewMode = ref("summary");
const summaryLimit = ref(20);
const pageSize = 20;
const groupPages = ref({ confirmed: 1, suspected: 1, manual_review: 1 });

const groupedOrder = [
  { key: "confirmed", label: "确定问题", tagType: "danger" },
  { key: "suspected", label: "疑似问题", tagType: "warning" },
  { key: "manual_review", label: "人工确认", tagType: "info" }
];

const safeAutoFixUnknownTypes = new Set([
  "body_font_unknown",
  "body_font_size_unknown",
  "body_line_spacing_unknown",
  "body_first_indent_unknown",
  "heading_font_unknown",
  "heading_font_size_unknown",
  "heading_bold_unknown",
  "heading_alignment_unknown"
]);

const problemTypeMap = {
  body_font: "正文字体",
  body_font_size: "正文字号",
  line_spacing: "正文行距",
  first_line_indent: "首行缩进",
  paragraph_spacing: "段前段后间距",
  heading_format: "标题格式",
  heading_number: "标题编号连续性",
  heading_hierarchy: "标题层级",
  suspected_heading: "疑似标题",
  page_margin: "页边距",
  paper_size: "纸张大小",
  header_footer: "页眉页脚",
  page_number: "页码",
  section_break: "分节符",
  figure_table_number: "图表编号",
  figure_caption_position: "图题位置",
  table_caption_position: "表题位置",
  image_alignment: "图片对齐",
  toc: "目录",
  reference_numbering: "参考文献编号",
  reference_number_duplicate: "参考文献编号重复",
  reference_number_out_of_order: "参考文献乱序",
  reference_number_not_continuous: "参考文献编号不连续",
  reference_numbering_mixed_format: "参考文献编号格式混用",
  reference_entry_empty: "参考文献空条目",
  reference_entry_unrecognized: "参考文献条目未识别",
  reference_entries_empty: "参考文献区域为空",
  reference_entries_uncertain: "参考文献条目待确认",
  reference_region_missing: "参考文献区域缺失",
  reference_region_uncertain: "参考文献区域待确认",
  reference_completeness: "参考文献完整性",
  reference_type_mark: "参考文献类型标识"
};

const problemDescMap = {
  "body font mismatch": "正文字体与标准不一致",
  "body font size mismatch": "正文字号与标准不一致",
  "body line spacing mismatch": "正文行距与标准不一致",
  "body first line indent mismatch": "正文首行缩进与标准不一致",
  "body paragraph spacing mismatch": "正文段前段后间距与标准不一致",
  "heading number not continuous": "标题编号不连续",
  "heading hierarchy jump detected": "标题层级跳跃",
  "page number field not detected": "未检测到页码域",
  "paper size mismatch": "纸张大小不符合标准",
  "header missing": "页眉缺失",
  "footer missing": "页脚缺失",
  "reference index not continuous": "参考文献编号不连续",
  "reference numbers are out of order": "参考文献编号乱序",
  "duplicate reference number detected": "参考文献编号重复",
  "reference entry content is empty": "参考文献条目为空",
  "entry numbering format not recognized": "参考文献编号格式无法识别",
  "reference numbering is not continuous": "参考文献编号不连续",
  "references region exists but contains no entries": "参考文献区域存在但没有条目",
  "reference region not detected": "未检测到参考文献区域",
  "low confidence heading candidate": "标题识别置信度较低，建议人工确认"
};

const suggestionMap = {
  "use standard body font": "请使用规范要求的正文字体",
  "use standard body font size": "请将正文字号调整为规范值",
  "set body line spacing to standard value": "请将正文行距调整为规范值",
  "set first line indent to standard value": "请将正文首行缩进调整为规范值",
  "normalize heading style": "请统一并规范标题样式",
  "check heading numbering sequence": "请检查并修正标题编号顺序",
  "insert page number field": "请插入页码域",
  "set paper size to A4": "请将纸张大小设置为 A4",
  "fill empty reference entries": "请补全空白参考文献条目",
  "renumber reference entries": "请重新整理参考文献编号",
  "manual review required": "该项建议人工确认后处理",
  "manual review suggested": "建议人工复核后处理",
  "confirm effective format value manually": "当前格式值无法可靠读取，请人工确认"
};

const reasonMap = {
  matched_style_name: "匹配到样式名特征",
  matched_number_pattern: "匹配到编号规则",
  compact_numbered_heading: "紧凑编号样式疑似标题",
  short_text: "文本较短，符合标题特征",
  bold: "检测到加粗特征",
  larger_font: "字号偏大，符合标题特征",
  slightly_larger_font: "字号略大，疑似标题特征",
  large_font_size: "字号偏大，符合标题特征",
  center_aligned: "居中对齐，符合标题特征",
  left_aligned: "左对齐，疑似正文或低级标题",
  chapter_keyword: "包含章节关键词",
  centered_alignment: "居中对齐，符合标题特征",
  in_body_region: "位于正文区域",
  contains_section_keyword: "包含章节关键词",
  suspected_by_heuristics: "规则命中但置信度不足",
  low_confidence: "置信度较低",
  format_value_unknown: "格式值无法可靠读取"
};

onMounted(() => {
  const q = route.query.task_id || route.query.taskId;
  if (q) {
    taskId.value = String(q);
    loadResult();
  }
});

watch([statusFilter, severityFilter, keyword], () => {
  groupPages.value = { confirmed: 1, suspected: 1, manual_review: 1 };
});

const normalizedIssues = computed(() =>
  (issues.value || []).map((item) => {
    const confidence = Number(item?.confidence ?? 0);
    const reasons = Array.isArray(item?.reasons) ? item.reasons : [];
    const normalizedStatus = normalizeIssueStatus(item?.issue_status, confidence, reasons);
    const autoFix = Boolean(item?.auto_fix);
    const problemType = String(item?.problem_type || "");
    const hasSuspectedHint = reasons.some((r) => String(r).toLowerCase().includes("suspected"));
    const isSafeUnknownFixable = safeAutoFixUnknownTypes.has(problemType) && confidence >= 0.68 && !hasSuspectedHint;
    const isAutoFixable = (autoFix && normalizedStatus === "confirmed" && confidence >= 0.68) || isSafeUnknownFixable;
    return { ...item, problem_type: problemType, confidence, reasons, normalizedStatus, isAutoFixable };
  })
);

const filteredIssues = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return normalizedIssues.value.filter((item) => {
    const severityOk = severityFilter.value === "ALL" || item.severity === severityFilter.value;
    let statusOk = true;
    if (statusFilter.value === "confirmed") statusOk = item.normalizedStatus === "confirmed";
    if (statusFilter.value === "suspected") statusOk = item.normalizedStatus === "suspected";
    if (statusFilter.value === "manual_review") statusOk = item.normalizedStatus === "manual_review";
    if (statusFilter.value === "auto_fixable") statusOk = item.isAutoFixable;
    if (!severityOk || !statusOk) return false;
    if (!key) return true;
    const searchable = [
      item.problem_type,
      item.problem_desc,
      item.position,
      item.suggestion,
      (item.reasons || []).join("|"),
      displayProblemType(item.problem_type),
      displayProblemDesc(item.problem_desc),
      displayPosition(item),
      displaySuggestion(item.suggestion),
      (item.reasons || []).map(displayReason).join("|")
    ]
      .map((x) => String(x || "").toLowerCase())
      .join("|");
    return searchable.includes(key);
  });
});

const groupedIssueMap = computed(() => {
  const out = { confirmed: [], suspected: [], manual_review: [] };
  filteredIssues.value.forEach((item) => {
    if (!out[item.normalizedStatus]) out.manual_review.push(item);
    else out[item.normalizedStatus].push(item);
  });
  return out;
});

const autoFixableCount = computed(() => normalizedIssues.value.filter((item) => item.isAutoFixable).length);
const autoFixCoveragePercent = computed(() => {
  const total = normalizedIssues.value.length;
  if (!total) return "0%";
  return `${((autoFixableCount.value / total) * 100).toFixed(1)}%`;
});

const issueSummaryRows = computed(() => {
  const total = filteredIssues.value.length || 1;
  const grouped = new Map();
  filteredIssues.value.forEach((item) => {
    const k = String(item.problem_type || "unknown");
    if (!grouped.has(k)) {
      grouped.set(k, {
        problemType: k,
        typeLabel: displayProblemType(k),
        count: 0,
        confirmed: 0,
        suspected: 0,
        manual_review: 0,
        autoFixable: 0,
        sampleSuggestion: "-"
      });
    }
    const row = grouped.get(k);
    row.count += 1;
    row[item.normalizedStatus] += 1;
    if (item.isAutoFixable) row.autoFixable += 1;
    if (row.sampleSuggestion === "-" && item.suggestion) row.sampleSuggestion = displaySuggestion(item.suggestion);
  });
  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, ratio: `${((row.count / total) * 100).toFixed(1)}%` }));
});

const limitedSummaryRows = computed(() => (!summaryLimit.value || summaryLimit.value <= 0 ? issueSummaryRows.value : issueSummaryRows.value.slice(0, summaryLimit.value)));

function pagedGroupIssues(groupKey) {
  const current = groupPages.value[groupKey] || 1;
  const start = (current - 1) * pageSize;
  return groupedIssueMap.value[groupKey].slice(start, start + pageSize);
}

function groupStartIndex(groupKey) {
  const current = groupPages.value[groupKey] || 1;
  return (current - 1) * pageSize;
}

function onGroupPageChange(groupKey, next) {
  groupPages.value[groupKey] = next;
}

function focusProblemType(problemType) {
  keyword.value = displayProblemType(problemType);
  viewMode.value = "detail";
}

function normalizeIssueStatus(rawStatus, confidence, reasons) {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "confirmed" || status === "suspected" || status === "manual_review") return status;
  if (status === "open") {
    const hasSuspectedHint = reasons.some((r) => String(r).toLowerCase().includes("suspected"));
    if (hasSuspectedHint) return "suspected";
    return confidence >= 0.68 ? "confirmed" : "manual_review";
  }
  return confidence >= 0.68 ? "confirmed" : "manual_review";
}

function statusLabel(status) {
  if (status === "confirmed") return "确定问题";
  if (status === "suspected") return "疑似问题";
  return "人工确认";
}

function statusTagType(status) {
  if (status === "confirmed") return "danger";
  if (status === "suspected") return "warning";
  return "info";
}

function toPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `${(num * 100).toFixed(0)}%`;
}

async function loadResult() {
  if (!taskId.value) {
    ElMessage.warning("请输入任务ID");
    return;
  }
  loading.value = true;
  try {
    const res = await getReportApi(taskId.value);
    result.value = res.data;
    issues.value = res.data?.details?.issues || [];
  } finally {
    loading.value = false;
  }
}

function severityTagType(severity) {
  if (severity === "ERROR") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function severityLabel(severity) {
  if (severity === "ERROR") return "错误";
  if (severity === "WARNING") return "警告";
  return "提示";
}

function displayTaskStatus(status) {
  const key = String(status || "").trim().toUpperCase();
  const taskStatusMap = {
    SUCCESS: "检测完成",
    FAILED: "检测失败",
    RUNNING: "检测中",
    PENDING: "排队中",
    QUEUED: "排队中",
    CREATED: "已创建",
    CANCELLED: "已取消"
  };
  if (taskStatusMap[key]) return taskStatusMap[key];
  return zhFallback(status, "处理中");
}

function zhFallback(text, fallback) {
  const v = String(text || "");
  return /[A-Za-z]/.test(v) ? fallback : v;
}

function displayProblemType(problemType) {
  const key = String(problemType || "");
  if (problemTypeMap[key]) return problemTypeMap[key];
  if (key.endsWith("_unknown")) {
    const base = key.replace(/_unknown$/, "");
    if (problemTypeMap[base]) return `${problemTypeMap[base]}（待确认）`;
  }
  return zhFallback(key, "未分类问题（英文键）") || "-";
}

function displayProblemDesc(problemDesc) {
  const key = String(problemDesc || "");
  if (problemDescMap[key]) return problemDescMap[key];
  return zhFallback(key, "该问题描述为英文，请按模板要求人工复核") || "-";
}

function displaySuggestion(suggestion) {
  const key = String(suggestion || "");
  if (!key) return "-";
  const trimmed = key.trim();
  const normalized = trimmed.toLowerCase();
  if (suggestionMap[key]) return suggestionMap[key];
  if (suggestionMap[normalized]) return suggestionMap[normalized];

  const rules = [
    [/^manual review:\s*(.+)$/i, "需人工确认：$1"],
    [/^fill this reference entry content$/i, "请补全该参考文献条目内容"],
    [/^sort or renumber reference entries$/i, "请按顺序调整或重新编号参考文献条目"],
    [/^renumber references continuously$/i, "请将参考文献编号调整为连续"],
    [/^add reference entries under references heading$/i, "请在参考文献标题下补充有效条目"],
    [/^confirm whether references section is present$/i, "请人工确认文档中是否存在参考文献章节"],
    [/^verify if this paragraph is a reference entry$/i, "请人工确认该段是否为参考文献条目"],
    [/^manual review suggested$/i, "建议人工复核后处理"],
    [/^use one consistent numbering format$/i, "请统一参考文献编号格式"],
    [/^insert page number field$/i, "请插入页码域"],
    [/^set paper size to a4$/i, "请将纸张大小设置为 A4"],
    [/^set body line spacing to standard value$/i, "请将正文行距调整为规范值"],
    [/^set first line indent to standard value$/i, "请将正文首行缩进调整为规范值"],
    [/^confirm effective format value manually$/i, "请人工确认有效格式值"],
    [/^add header content$/i, "请补充页眉内容"],
    [/^add footer content$/i, "请补充页脚内容"]
  ];
  for (const [pattern, text] of rules) {
    if (pattern.test(normalized)) return normalized.replace(pattern, text);
  }
  return zhFallback(trimmed, "请按模板规范人工调整该项格式") || "-";
}

function displayReason(reason) {
  const key = String(reason || "").trim();
  if (!key) return "-";
  if (reasonMap[key]) return reasonMap[key];
  return zhFallback(key, "规则命中（英文原因），建议人工复核") || "-";
}

function inferAreaByProblemType(problemType) {
  const t = String(problemType || "").toLowerCase();
  if (!t) return "";
  if (t.includes("figure") || t.includes("table") || t.includes("image")) return "图表区域";
  if (t.includes("reference")) return "参考文献区域";
  if (t.includes("heading")) return "标题区域";
  if (t.includes("body") || t.includes("paragraph")) return "正文区域";
  if (t.includes("page") || t.includes("paper") || t.includes("header") || t.includes("footer")) return "页面设置区域";
  if (t.includes("toc") || t.includes("catalog")) return "目录区域";
  return "";
}

function displayPosition(input) {
  const row = typeof input === "object" && input !== null ? input : { position: input };
  const raw = String(row.position || "").trim();
  const areaHint = inferAreaByProblemType(row.problem_type);
  if (!raw) return "-";
  const lower = raw.toLowerCase();
  if (lower === "document") return "文档整体";
  const sectionMatch = lower.match(/^section\s+(\d+)$/);
  if (sectionMatch) return `第 ${sectionMatch[1]} 节`;
  const paraWithText = raw.match(/^paragraph\s+(\d+)\s*\((.*)\)$/i);
  if (paraWithText) {
    const preview = String(paraWithText[2] || "").trim();
    return preview ? `"${preview}..."` : `第 ${paraWithText[1]} 段`;
  }
  const paraMatch = lower.match(/^paragraph\s+(\d+)$/);
  if (paraMatch) return areaHint || "文中对应位置";
  if (/^references region$/i.test(raw)) return "参考文献区域";
  if (/^catalog region$/i.test(raw)) return "目录区域";
  if (/^unknown$/i.test(raw)) return "未知位置";
  if (/[A-Za-z]/.test(raw)) return areaHint || "文中对应位置";
  return raw;
}

function parseDbDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasTz = /[zZ]|[+-]\d{2}(:?\d{2})?$/.test(raw);
  if (hasTz) {
    let normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    normalized = normalized.replace(/([+-]\d{2})$/, "$1:00").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const dt = new Date(normalized);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const y = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6] || "0");
    const dt = new Date(Date.UTC(y, mon, d, hh, mm, ss));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(raw.replace(" ", "T"));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toBeijingString(dt) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(dt);
  const get = (type) => parts.find((x) => x.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatToBeijing(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const dt = parseDbDate(value);
  if (!dt) return raw.replace("T", " ").replace(/[zZ]|([+-]\d{2}(:?\d{2})?)$/, "");
  return toBeijingString(dt);
}

function saveBlobResponseAsFile(resp, blob, fallbackName) {
  const disposition = String(resp?.headers?.["content-disposition"] || "");
  const utf8NameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  let fileName = fallbackName;
  if (utf8NameMatch?.[1]) {
    try {
      fileName = decodeURIComponent(utf8NameMatch[1].trim());
    } catch {
      fileName = utf8NameMatch[1].trim() || fallbackName;
    }
  } else if (plainNameMatch?.[1]) {
    fileName = plainNameMatch[1].trim() || fallbackName;
  }
  if (!/\.xlsx$/i.test(fileName)) fileName = `${fileName}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadExcelReport() {
  const taskIdForDownload = result.value?.task_id || taskId.value;
  const fileId = pickReportFileId("excel");
  downloadingExcel.value = true;

  try {
    // 优先按任务号下载（后端会强制重建，确保拿到最新中文版报告）
    if (taskIdForDownload) {
      const fallbackResp = await downloadReportExcelByTaskApi(taskIdForDownload);
      const fallbackBlob = fallbackResp.data;
      if (!fallbackBlob || fallbackBlob.size === 0) {
        ElMessage.error("Excel 报告重建失败：空文件");
        return;
      }
      saveBlobResponseAsFile(fallbackResp, fallbackBlob, `report_task_${taskIdForDownload}.xlsx`);
      ElMessage.success("Excel 报告已自动重建并下载");
      return;
    }

    if (!fileId) {
      ElMessage.warning("当前任务没有可下载的 Excel 报告");
      return;
    }

    const resp = await downloadFileBlobApi(fileId);
    const blob = resp.data;
    if (!blob || blob.size === 0) {
      ElMessage.error("下载失败：空文件");
      return;
    }

    saveBlobResponseAsFile(resp, blob, `report_task_${taskIdForDownload}.xlsx`);
    ElMessage.success("Excel 报告下载成功");
  } catch (error) {
    const status = Number(error?.response?.status || 0);

    if (status === 404 && taskIdForDownload) {
      try {
        const fallbackResp = await downloadReportExcelByTaskApi(taskIdForDownload);
        const fallbackBlob = fallbackResp.data;
        if (!fallbackBlob || fallbackBlob.size === 0) {
          ElMessage.error("Excel 报告重建失败：空文件");
        } else {
          saveBlobResponseAsFile(fallbackResp, fallbackBlob, `report_task_${taskIdForDownload}.xlsx`);
          ElMessage.success("Excel 报告已自动重建并下载");
        }
      } catch (fallbackError) {
        const fallbackStatus = Number(fallbackError?.response?.status || 0);
        if (fallbackStatus === 403) ElMessage.error("没有权限重建该任务报告");
        else if (fallbackStatus === 404) ElMessage.error("任务结果不存在，无法重建报告");
        else ElMessage.error("Excel 报告不存在，且重建失败");
      }
    } else if (status === 403) {
      ElMessage.error("没有权限下载该报告");
    } else {
      ElMessage.error("Excel 报告下载失败，请稍后重试");
    }
  } finally {
    downloadingExcel.value = false;
  }
}
</script>

<style scoped>
.query-card {
  min-height: 92px;
}

.query-toolbar {
  margin-bottom: 0;
}

.filter-toolbar {
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 14px;
}

.group-block {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.22);
}

.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
}

.reason-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.issues-table :deep(.el-table__body-wrapper .el-table__row td) {
  vertical-align: top;
}

.issues-table :deep(.cell) {
  line-height: 1.6;
}

@media (max-width: 768px) {
  .query-toolbar :deep(.el-input) {
    width: 100% !important;
    max-width: none !important;
  }
}
</style>



