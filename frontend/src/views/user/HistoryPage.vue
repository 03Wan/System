<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">历史记录</h2>
        <div class="page-sub">查看历史检测任务，并可快速进入结果详情。</div>
      </div>
      <el-space>
        <el-button type="primary" :loading="loading" @click="loadHistory">刷新</el-button>
        <el-button @click="clearLocal">清空本地缓存</el-button>
      </el-space>
    </div>

    <el-card class="card panel-pad">
      <el-row :gutter="10" class="mini-metrics">
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="记录总数" :value="rows.length" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="通过任务" :value="passCount" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="平均得分" :value="avgScore" /></el-col>
      </el-row>

      <div class="table-wrap">
        <el-table :data="rows" border stripe max-height="720">
          <el-table-column prop="task_id" label="任务ID" width="110" />
          <el-table-column prop="task_no" label="任务编号" min-width="150" />
          <el-table-column prop="paper_id" label="文档ID" width="100" />
          <el-table-column prop="score" label="得分" width="90" />
          <el-table-column prop="pass_flag" label="是否通过" width="100">
            <template #default="{ row }">
              <el-tag :type="row.pass_flag === 1 ? 'success' : 'danger'">{{ row.pass_flag === 1 ? "是" : "否" }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="created_at" label="创建时间" min-width="220">
            <template #default="{ row }">{{ formatToBeijing(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="goResult(row.task_id)">查看结果</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="!rows.length" class="empty-wrap" style="margin-top: 10px">
        <el-empty description="暂无历史记录，请先上传文档并执行检测。" :image-size="66" />
      </div>

      <el-alert
        v-if="apiUnavailable"
        style="margin-top: 10px"
        type="warning"
        :closable="false"
        title="历史接口不可用，当前展示本地缓存记录。"
      />
      <el-alert
        v-if="apiErrorText"
        style="margin-top: 10px"
        type="error"
        :closable="false"
        :title="apiErrorText"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getHistoryApi } from "../../api/paper";

const router = useRouter();
const loading = ref(false);
const rows = ref([]);
const apiUnavailable = ref(false);
const apiErrorText = ref("");

const passCount = computed(() => rows.value.filter((r) => Number(r.pass_flag) === 1).length);
const avgScore = computed(() => {
  const nums = rows.value.map((r) => Number(r.score)).filter((v) => !Number.isNaN(v));
  if (!nums.length) return 0;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1));
});

onMounted(() => {
  loadHistory();
});

async function loadHistory() {
  loading.value = true;
  apiUnavailable.value = false;
  apiErrorText.value = "";
  try {
    const res = await getHistoryApi();
    rows.value = res?.data?.list || [];
  } catch (error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.message || "请求失败";
    rows.value = JSON.parse(localStorage.getItem("detect_history") || "[]");
    if (status === 404) {
      apiUnavailable.value = true;
    } else {
      apiErrorText.value = `历史接口请求失败（${status || "unknown"}）：${message}`;
    }
  } finally {
    loading.value = false;
  }
}

function clearLocal() {
  localStorage.removeItem("detect_history");
  rows.value = [];
  ElMessage.success("本地缓存已清空");
}

function goResult(taskId) {
  router.push(`/user/result?task_id=${taskId}`);
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
</script>

<style scoped>
.mini-metrics {
  margin-bottom: 10px;
  padding: 2px 2px 10px;
}

.table-wrap {
  border-radius: 14px;
  overflow: hidden;
}

.table-wrap :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 2;
}

.table-wrap :deep(.el-table__body-wrapper) {
  max-height: 620px;
}
</style>
