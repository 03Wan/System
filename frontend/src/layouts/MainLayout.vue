<template>
  <el-container style="min-height: 100vh">
    <el-aside v-if="!isMobile" width="228px" class="aside card">
      <div class="aside-main">
        <div class="brand-wrap">
          <div class="brand">智能文档排版审查系统</div>
          <div class="brand-sub">规范检查 · 问题定位 · 一键排版</div>
        </div>
        <el-menu :default-active="activeMenu" class="menu" text-color="var(--aside-text)" @select="onMenuSelect">
          <template v-if="auth.role === 'USER'">
            <el-menu-item index="/user/home">用户首页</el-menu-item>
            <el-menu-item index="/user/upload">文档上传</el-menu-item>
            <el-menu-item index="/user/result">检测结果</el-menu-item>
            <el-menu-item index="/user/history">历史记录</el-menu-item>
          </template>
          <template v-else>
            <el-menu-item index="/admin/home">管理员首页</el-menu-item>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
            <el-menu-item index="/admin/templates">模板管理</el-menu-item>
            <el-menu-item index="/admin/stats">数据统计</el-menu-item>
          </template>
        </el-menu>
      </div>
      <div class="aside-footer">
        <div class="theme-switch-wrapper">
          <span class="theme-label">界面外观</span>
          <el-switch
            :model-value="theme === 'dark'"
            inline-prompt
            active-text="深色"
            inactive-text="浅色"
            @change="toggleTheme"
          />
        </div>
        <div class="aside-extra">
          <div class="extra-links">
            <el-link type="info" :underline="false" @click="handleUnderDev"><el-icon><ChatDotRound /></el-icon> 意见反馈</el-link>
          </div>
          <div class="copyright">v1.0.0 · © 2026 System</div>
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header card">
        <div class="left-box">
          <el-button v-if="isMobile" circle @click="drawerVisible = true">
            <el-icon><Menu /></el-icon>
          </el-button>
          <div>
            <div class="name-line">
              <strong>{{ auth.user?.real_name || auth.user?.username }}</strong>
            </div>
            <div class="subline">欢迎回来，今天也顺利完成检测任务</div>
          </div>
        </div>

        <el-space>
          <el-button type="danger" plain @click="onLogout">退出登录</el-button>
        </el-space>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <el-drawer v-model="drawerVisible" title="导航菜单" size="230px" :with-header="true" class="mobile-drawer">
    <div class="drawer-container">
      <el-menu :default-active="activeMenu" class="drawer-menu" @select="onDrawerMenuSelect">
        <template v-if="auth.role === 'USER'">
          <el-menu-item index="/user/home">用户首页</el-menu-item>
          <el-menu-item index="/user/upload">文档上传</el-menu-item>
          <el-menu-item index="/user/result">检测结果</el-menu-item>
          <el-menu-item index="/user/history">历史记录</el-menu-item>
        </template>
        <template v-else>
          <el-menu-item index="/admin/home">管理员首页</el-menu-item>
          <el-menu-item index="/admin/users">用户管理</el-menu-item>
          <el-menu-item index="/admin/templates">模板管理</el-menu-item>
          <el-menu-item index="/admin/stats">数据统计</el-menu-item>
        </template>
      </el-menu>
      
      <div class="aside-footer drawer-footer">
        <div class="theme-switch-wrapper">
          <span class="theme-label">界面外观</span>
          <el-switch
            :model-value="theme === 'dark'"
            inline-prompt
            active-text="深色"
            inactive-text="浅色"
            @change="toggleTheme"
          />
        </div>
        <div class="aside-extra">
          <div class="extra-links">
            <el-link type="info" :underline="false" @click="handleUnderDev"><el-icon><ChatDotRound /></el-icon> 意见反馈</el-link>
          </div>
          <div class="copyright">v1.0.0 · © 2026 System</div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox, ElMessage } from "element-plus";
import { Menu, ChatDotRound } from "@element-plus/icons-vue";
import { useAuthStore } from "../stores/auth";
import { useTheme } from "../composables/useTheme";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { theme, initTheme, toggleTheme } = useTheme();

const drawerVisible = ref(false);
const isMobile = ref(window.innerWidth < 992);
const activeMenu = computed(() => route.path);

const onResize = () => {
  isMobile.value = window.innerWidth < 992;
  if (!isMobile.value) drawerVisible.value = false;
};

onMounted(() => {
  initTheme();
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
});

function onMenuSelect(index) {
  if (!index || index === route.path) return;
  router.push(index).catch(() => {});
}

function onDrawerMenuSelect(index) {
  drawerVisible.value = false;
  onMenuSelect(index);
}

async function onLogout() {
  await ElMessageBox.confirm("确认退出登录吗？", "提示", { type: "warning" });
  auth.logout();
  router.push("/login");
}

function handleUnderDev() {
  ElMessage.info("此功能正在开发中...");
}
</script>

<style scoped>
.aside {
  position: sticky;
  top: 12px;
  height: calc(100vh - 24px);
  margin: 12px;
  margin-right: 10px;
  overflow: hidden;
  background: var(--aside-bg);
  border-color: rgba(145, 170, 207, 0.28);
  color: var(--aside-text);
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
}

.aside-main {
  flex: 1;
  overflow-y: auto;
}

.aside-footer {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  background: rgba(255, 255, 255, 0.05);
}

.theme-switch-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}

.theme-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--aside-text);
}

.aside-extra {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extra-links {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.extra-links .el-link {
  font-size: 12px;
  color: var(--muted-2);
}

.extra-links .el-link:hover {
  color: var(--brand);
}

.copyright {
  text-align: center;
  font-size: 11px;
  color: var(--muted-2);
  opacity: 0.8;
}

.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drawer-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.mobile-drawer :deep(.el-drawer__body) {
  padding: 0;
  display: flex;
  flex-direction: column;
}

.brand-wrap {
  padding: 20px 16px 14px;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--aside-brand);
  text-shadow: none;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.1px;
}

.brand-sub {
  margin-top: 5px;
  font-size: 12px;
  color: var(--muted-2);
}

.menu {
  background: transparent;
}

.menu :deep(.el-menu-item) {
  color: var(--aside-text) !important;
  height: 44px;
  line-height: 44px;
  font-size: 15px;
}

.menu :deep(.el-menu-item:hover) {
  background: var(--aside-item-hover-bg) !important;
}

.menu :deep(.el-menu-item.is-active) {
  background: var(--aside-item-active-bg) !important;
  color: var(--aside-item-active-text) !important;
  font-weight: 600;
}

.header {
  position: sticky;
  top: 12px;
  z-index: 20;
  margin: 12px 12px 0 6px;
  padding: 0 16px;
  height: var(--header-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--header-bg);
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: var(--shadow-soft);
}

.left-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-strong);
  line-height: 1.2;
}

.subline {
  margin-top: 2px;
  color: var(--muted-2);
  font-size: 13px;
  line-height: 1.4;
}

.main {
  padding: 14px 12px 18px 8px !important;
}

@media (max-width: 991px) {
  .header {
    margin: 10px 10px 0;
    top: 10px;
  }

  .main {
    padding: 12px 10px 14px !important;
  }
}
</style>
