<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">数据统计</h2>
        <div class="page-sub">查看全局检测数据与最近任务动态。</div>
      </div>
      <el-button type="primary" :loading="loading" @click="loadStats">刷新统计</el-button>
    </div>

    <el-row :gutter="12" class="metrics-row">
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="用户总数" :value="stats.user_count" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="文档总数" :value="stats.paper_count" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="任务总数" :value="stats.task_count" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="通过率(%)" :value="stats.pass_rate" /></el-card></el-col>
    </el-row>

    <el-row :gutter="12" class="metrics-row">
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="近10条均分" :value="recentAvgScore" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card class="card metric-card"><el-statistic title="今日任务量" :value="todayTaskCount" /></el-card></el-col>
      <el-col :xs="24" :md="12">
        <el-card class="card metric-card">
          <div class="subsection-title">系统提示</div>
          <div class="muted">
            {{ Number(stats.pass_rate || 0) >= 80 ? "通过率表现良好，建议继续稳定模板规则。" : "通过率偏低，建议重点检查模板阈值与标题规则配置。" }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="content-grid two data-grid" style="margin-top: 12px">
      <el-card class="card panel-pad">
        <div class="section-title">业务概览</div>
        <el-progress :percentage="Number(stats.pass_rate || 0)" :stroke-width="18" status="success" />
        <div class="muted" style="margin-top: 8px">当前通过率按检测结果计算，建议结合模板优化持续提升。</div>
      </el-card>

      <el-card class="card panel-pad">
        <div class="section-title">最近任务（{{ recentRows.length }}）</div>
        <div class="recent-table-wrap">
          <el-table :data="recentRows" border stripe class="recent-table" empty-text="暂无任务数据">
            <el-table-column prop="task_id" label="任务ID" width="92" align="center" />
            <el-table-column prop="paper_id" label="文档ID" width="92" align="center" />
            <el-table-column prop="username" label="用户名" min-width="130" show-overflow-tooltip />
            <el-table-column prop="score" label="得分" width="96" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.score >= 80 ? 'success' : row.score > 0 ? 'warning' : 'info'">
                  {{ formatScore(row.score) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" min-width="192">
              <template #default="{ row }">{{ formatToBeijing(row.created_at) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getStatsApi } from "../../api/admin";

const loading = ref(false);
const stats = reactive({
  user_count: 0,
  paper_count: 0,
  task_count: 0,
  pass_rate: 0,
  recent_tasks: []
});

const recentRows = computed(() => {
  const list = Array.isArray(stats.recent_tasks) ? stats.recent_tasks : [];
  return list.map((r, idx) => ({
    task_id: r?.task_id ?? r?.id ?? idx + 1,
    paper_id: r?.paper_id ?? "-",
    username: r?.username ?? "-",
    score: Number(r?.score ?? 0),
    created_at: r?.created_at ?? null
  }));
});

const recentAvgScore = computed(() => {
  const list = recentRows.value;
  if (!list.length) return 0;
  const nums = list.map((r) => Number(r.score)).filter((v) => !Number.isNaN(v));
  if (!nums.length) return 0;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1));
});

const todayTaskCount = computed(() => {
  const list = recentRows.value;
  if (!list.length) return 0;
  const today = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const todayKey = today.replace(/\//g, "-");
  return list.filter((r) => formatToBeijing(r.created_at).startsWith(todayKey)).length;
});

onMounted(() => {
  loadStats();
});

async function loadStats() {
  loading.value = true;
  try {
    const res = await getStatsApi();
    Object.assign(stats, res?.data || {});
  } catch (error) {
    ElMessage.error(error?.message || "统计数据加载失败");
  } finally {
    loading.value = false;
  }
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

function formatScore(score) {
  const n = Number(score || 0);
  if (Number.isNaN(n)) return "0.0";
  return n.toFixed(1);
}
</script>

<style scoped>
.recent-table-wrap {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
}

.metrics-row :deep(.el-col) {
  margin-bottom: 12px;
}

.data-grid > .el-card {
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.recent-table {
  min-width: 680px;
}

.recent-table :deep(.el-table__cell .cell) {
  padding-top: 4px;
  padding-bottom: 4px;
}

.recent-table :deep(.el-table__header th) {
  font-weight: 600;
}

.recent-table-wrap :deep(.el-table__body-wrapper) {
  max-height: 560px;
}
</style>




