<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">用户工作台</h2>
        <div class="page-sub">查看检测概览，快速进入上传、检测和历史记录页面。</div>
      </div>
      <el-space>
        <el-button type="primary" @click="go('/user/upload')">上传文档</el-button>
        <el-button @click="go('/user/history')">历史记录</el-button>
      </el-space>
    </div>

    <el-row :gutter="12" class="metrics-row">
      <el-col :xs="24" :md="8">
        <el-card class="card metric-card">
          <el-statistic title="累计检测任务" :value="stats.taskCount" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card class="card metric-card">
          <el-statistic title="平均得分" :value="stats.avgScore" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card class="card metric-card">
          <el-statistic title="通过率(%)" :value="stats.passRate" />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="card panel-pad quick-banner">
      <div class="subsection-title">快速开始</div>
      <div class="muted">
        推荐流程：先上传文档并选择模板，检测后进入结果页下载 Excel 报告，再根据问题清单定向修正。
      </div>
    </el-card>

    <div class="content-grid two main-grid">
      <el-card class="card panel-pad">
        <div class="section-title">常用操作</div>
        <el-row :gutter="10" class="quick-grid">
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="go('/user/upload')">
              <h4>文档上传与检测</h4>
              <p class="muted">上传 docx，选择模板，立即开始格式检测。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="go('/user/result')">
              <h4>检测结果查询</h4>
              <p class="muted">输入任务 ID 查看报告详情与下载链接。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card" @click="go('/user/history')">
              <h4>历史任务记录</h4>
              <p class="muted">浏览检测历史并快速跳转到结果页。</p>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-card class="card quick-card">
              <h4>模板化检测</h4>
              <p class="muted">支持管理员配置模板后按模板执行检测。</p>
            </el-card>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="card panel-pad">
        <div class="section-title">使用建议</div>
        <el-timeline class="tips-timeline">
          <el-timeline-item timestamp="步骤 1">先在“文档上传”选择检测模板并上传文件</el-timeline-item>
          <el-timeline-item timestamp="步骤 2">检测完成后进入“检测结果”查看问题明细</el-timeline-item>
          <el-timeline-item timestamp="步骤 3">如需修改格式，可点击“一键排版”生成新文件</el-timeline-item>
          <el-timeline-item timestamp="步骤 4">在“历史记录”中复用既往任务</el-timeline-item>
        </el-timeline>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { getUserStatsApi } from "../../api/paper";

const router = useRouter();
const stats = reactive({
  taskCount: 0,
  avgScore: 0,
  passRate: 0
});

async function go(path) {
  try {
    await router.push(path);
  } catch (e) {
    // Fallback for rare router state issues.
    window.location.href = path;
  }
}

onMounted(async () => {
  try {
    const res = await getUserStatsApi();
    const data = res?.data || {};
    stats.taskCount = Number(data.task_count || 0);
    stats.avgScore = Number(data.avg_score || 0);
    stats.passRate = Number(data.pass_rate || 0);
    localStorage.setItem("task_count", String(stats.taskCount));
    localStorage.setItem("avg_score", String(stats.avgScore));
    localStorage.setItem("pass_rate", String(stats.passRate));
  } catch (error) {
    stats.taskCount = Number(localStorage.getItem("task_count") || 0);
    stats.avgScore = Number(localStorage.getItem("avg_score") || 0);
    stats.passRate = Number(localStorage.getItem("pass_rate") || 0);
  }
});
</script>

<style scoped>
.metrics-row :deep(.el-col) {
  margin-bottom: 12px;
}

.main-grid {
  margin-top: 14px;
  align-items: start;
}

.quick-banner {
  margin-top: 4px;
  border-style: dashed;
}

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
  line-height: 1.35;
}

.quick-card p {
  line-height: 1.55;
  margin: 0;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.tips-timeline {
  padding-top: 8px;
}

.tips-timeline :deep(.el-timeline-item__content) {
  line-height: 1.6;
}

.tips-timeline :deep(.el-timeline-item__timestamp) {
  font-weight: 700;
}

@media (max-width: 768px) {
  .quick-card {
    min-height: 132px;
  }
}
</style>
