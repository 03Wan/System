<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">管理员总览</h2>
        <div class="page-sub">集中查看用户、模板和检测运行情况。</div>
      </div>
      <el-space>
        <el-button type="primary" @click="$router.push('/admin/users')">用户管理</el-button>
        <el-button @click="$router.push('/admin/templates')">模板管理</el-button>
      </el-space>
    </div>

    <el-row :gutter="12" class="metrics-row">
      <el-col :xs="12" :md="6">
        <el-card class="card metric-card"><el-statistic title="用户总数" :value="stats.user_count || 0" /></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card class="card metric-card"><el-statistic title="模板总数" :value="stats.template_count || 0" /></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card class="card metric-card"><el-statistic title="任务总数" :value="stats.task_count || 0" /></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card class="card metric-card"><el-statistic title="通过率(%)" :value="stats.pass_rate || 0" /></el-card>
      </el-col>
    </el-row>

    <div class="content-grid two home-grid" style="margin-top: 12px">
      <el-card class="card panel-pad home-panel">
        <div class="panel-head">
          <div class="section-title">快捷入口</div>
          <el-tag type="info">推荐</el-tag>
        </div>
        <div class="panel-sub">建议优先维护用户与模板配置，再查看统计结果。</div>
        <el-row :gutter="10" class="quick-grid">
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="$router.push('/admin/users')">
              <h4>用户管理</h4>
              <p class="muted">创建账号、角色管理、启用禁用。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="$router.push('/admin/templates')">
              <h4>模板和规则</h4>
              <p class="muted">配置检测模板和规则参数，支持动态生效。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="$router.push('/admin/stats')">
              <h4>数据统计</h4>
              <p class="muted">查看任务趋势与最近检测记录。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card">
              <h4>系统监控</h4>
              <p class="muted">跨域、鉴权、存储路径等基础配置请定期核验。</p>
            </el-card>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="card panel-pad home-panel">
        <div class="panel-head">
          <div class="section-title">最近任务</div>
          <el-tag size="small">最近 {{ recentRows.length }} 条</el-tag>
        </div>
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
        <div v-if="!recentRows.length" class="empty-wrap" style="margin-top: 10px">
          <el-empty description="当前暂无任务，建议先在用户端上传文档并执行检测" :image-size="66" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from "vue";
import { getStatsApi } from "../../api/admin";

const stats = reactive({
  user_count: 0,
  template_count: 0,
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

onMounted(async () => {
  try {
    const res = await getStatsApi();
    Object.assign(stats, res?.data || {});
  } catch (error) {}
});

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
.quick-grid :deep(.el-col) {
  display: flex;
}

.quick-grid :deep(.el-col > .el-card) {
  width: 100%;
}

.quick-card {
  min-height: 148px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.quick-card h4 {
  margin: 0 0 8px;
  font-size: 18px;
}

.quick-card p {
  line-height: 1.55;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.recent-table-wrap {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
}

.metrics-row :deep(.el-col) {
  margin-bottom: 12px;
}

.home-grid {
  align-items: stretch;
  gap: 14px;
}

.home-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.home-panel .recent-table-wrap {
  flex: 1;
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
</style>




