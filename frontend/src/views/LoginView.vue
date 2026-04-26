<template>
  <div class="login-wrap">
    <div class="theme-switch card">
      <el-switch
        :model-value="theme === 'dark'"
        inline-prompt
        active-text="深色"
        inactive-text="浅色"
        @change="toggleTheme"
      />
    </div>

    <div class="login-shell card">
      <section class="hero">
        <div class="hero-badge">文档排版助手</div>
        <h1>智能文档排版审查系统</h1>
        <p>
          从检测、诊断到优化导出，一站式完成文档排版规范检查，
          让提交更高效、更稳定。
        </p>
        <ul class="hero-list">
          <li>自动校验字体、字号、行距、页边距与标题层级</li>
          <li>问题定位到具体段落，便于快速修订</li>
          <li>一键生成优化版本，保留原稿不覆盖</li>
        </ul>
        <div class="hero-foot">支持 Word `.docx` 文档上传、检测与优化导出</div>
      </section>

      <section class="auth-pane">
        <div class="login-panel card">
          <div class="login-top">欢迎回来</div>
          <h2>账号登录</h2>
          <p class="hint">请输入账号密码登录系统</p>

          <el-form :model="form" label-position="top" @keyup.enter="onSubmit">
            <el-form-item label="用户名">
              <el-input v-model="form.username" placeholder="请输入用户名" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
            </el-form-item>
            <el-button type="primary" :loading="loading" style="width: 100%" @click="onSubmit">登录</el-button>
            <div class="actions">
              <el-button link type="primary" @click="onRegisterTip">立即注册</el-button>
              <el-button link @click="forgotVisible = true">忘记密码</el-button>
            </div>
          </el-form>

          <p class="assist">安全登录环境，保障账号与文档数据安全</p>
        </div>
      </section>
    </div>

    <el-dialog v-model="forgotVisible" title="忘记密码" width="460px">
      <el-form :model="forgotForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="forgotForm.username" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="forgotForm.email" placeholder="邮箱或手机号至少填一个" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="forgotForm.phone" placeholder="邮箱或手机号至少填一个" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="forgotForm.new_password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forgotVisible = false">取消</el-button>
        <el-button type="primary" :loading="forgotLoading" @click="onForgotPassword">重置密码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { forgotPasswordApi, loginApi } from "../api/auth";
import { useAuthStore } from "../stores/auth";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ username: "", password: "" });
const forgotVisible = ref(false);
const forgotLoading = ref(false);
const forgotForm = reactive({ username: "", email: "", phone: "", new_password: "" });
const { theme, initTheme, toggleTheme } = useTheme();

onMounted(() => {
  initTheme();
});

function parseErrorMessage(error, fallback = "操作失败，请稍后重试") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

async function onSubmit() {
  if (!form.username || !form.password) {
    ElMessage.warning("请输入用户名和密码");
    return;
  }
  loading.value = true;
  try {
    const res = await loginApi(form);
    auth.setAuth(res.data.access_token, res.data.user);
    ElMessage.success("登录成功");
    router.push(res.data.user.role === "ADMIN" ? "/admin/home" : "/user/home");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "登录失败，请检查账号密码"));
  } finally {
    loading.value = false;
  }
}

function onRegisterTip() {
  ElMessage.info("注册功能暂未开启，敬请期待中");
}

async function onForgotPassword() {
  if (!forgotForm.username || !forgotForm.new_password) {
    ElMessage.warning("请填写用户名和新密码");
    return;
  }
  if (!forgotForm.email && !forgotForm.phone) {
    ElMessage.warning("邮箱或手机号至少填写一个");
    return;
  }
  forgotLoading.value = true;
  try {
    await forgotPasswordApi(forgotForm);
    ElMessage.success("密码重置成功，请重新登录");
    form.username = forgotForm.username;
    form.password = "";
    forgotVisible.value = false;
    Object.assign(forgotForm, { username: "", email: "", phone: "", new_password: "" });
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "重置失败，请稍后重试"));
  } finally {
    forgotLoading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 18px 20px;
}

.theme-switch {
  position: fixed;
  right: 24px;
  top: 20px;
  border-radius: 999px;
  padding: 9px 14px;
  z-index: 30;
}

.login-shell {
  width: min(1540px, 95vw);
  min-height: clamp(620px, 82vh, 840px);
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  border-radius: 30px;
  overflow: hidden;
}

.hero {
  position: relative;
  padding: 58px 56px 46px;
  background:
    radial-gradient(520px 320px at 8% 86%, rgba(121, 170, 244, 0.3) 0%, rgba(121, 170, 244, 0) 70%),
    linear-gradient(152deg, rgba(69, 120, 218, 0.22) 0%, rgba(84, 142, 235, 0.08) 38%, rgba(255, 255, 255, 0) 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero::after {
  content: "";
  position: absolute;
  right: -88px;
  top: -88px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, rgba(132, 177, 255, 0.46) 0%, rgba(132, 177, 255, 0) 72%);
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: var(--brand);
  background: color-mix(in srgb, var(--glass-bg-soft) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent);
  margin-bottom: 14px;
}

.hero h1 {
  margin: 0;
  max-width: 820px;
  font-size: clamp(48px, 3.8vw, 76px);
  line-height: 1.06;
  letter-spacing: 0.2px;
  color: var(--text-strong);
}

.hero p {
  margin: 16px 0 0;
  max-width: 780px;
  color: var(--muted-2);
  font-size: 20px;
  line-height: 1.56;
}

.hero-list {
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
  max-width: 780px;
  color: var(--text);
  font-size: 18px;
  line-height: 1.72;
}

.hero-list li {
  position: relative;
  padding-left: 24px;
}

.hero-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
}

.hero-list li + li {
  margin-top: 10px;
}

.hero-foot {
  margin-top: 18px;
  max-width: 780px;
  padding-top: 14px;
  color: var(--muted);
  font-size: 15px;
  border-top: 1px dashed rgba(126, 151, 190, 0.42);
}

.auth-pane {
  display: grid;
  place-items: center;
  padding: 34px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--glass-bg-soft) 92%, transparent) 0%, color-mix(in srgb, var(--glass-bg-soft) 98%, transparent) 100%);
  border-left: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.login-panel {
  width: 100%;
  max-width: 590px;
  padding: 34px 30px 24px;
  border-radius: 24px;
  box-shadow: 0 18px 42px rgba(40, 66, 106, 0.15);
}

.login-top {
  font-size: 13px;
  font-weight: 700;
  color: var(--brand);
  margin-bottom: 8px;
}

.login-panel h2 {
  margin: 0;
  font-size: clamp(42px, 2.8vw, 56px);
  line-height: 1.05;
  color: var(--text-strong);
}

.hint {
  margin: 10px 0 18px;
  color: var(--muted-2);
  font-size: 16px;
}

.actions {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  gap: 18px;
}

.assist {
  margin: 14px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--muted-2);
}

.login-panel :deep(.el-form-item) {
  margin-bottom: 14px;
}

.login-panel :deep(.el-form-item__label) {
  color: var(--muted);
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 600;
}

.login-panel :deep(.el-input__wrapper) {
  min-height: 52px;
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent) !important;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 88%, transparent) !important;
  box-shadow: none !important;
}

.login-panel :deep(.el-input__inner) {
  color: var(--text-strong) !important;
  font-size: 18px;
}

.login-panel :deep(.el-input__inner::placeholder) {
  color: var(--muted-2) !important;
}

@media (max-width: 1100px) {
  .login-shell {
    width: min(1240px, 96vw);
    grid-template-columns: 1fr 1fr;
  }

  .hero h1 {
    font-size: clamp(38px, 4.4vw, 52px);
  }

  .hero p,
  .hero-list {
    font-size: 16px;
  }
}

@media (max-width: 900px) {
  .login-wrap {
    padding: 12px;
  }

  .login-shell {
    min-height: unset;
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 28px 22px 22px;
  }

  .hero::after {
    display: none;
  }

  .hero h1 {
    font-size: 36px;
    max-width: none;
  }

  .hero p,
  .hero-list,
  .hero-foot {
    max-width: none;
    font-size: 16px;
  }

  .auth-pane {
    padding: 18px;
  }

  .login-panel {
    max-width: none;
    padding: 22px 18px 16px;
  }

  .login-panel h2 {
    font-size: 36px;
  }

  .login-panel :deep(.el-input__wrapper) {
    min-height: 48px;
  }

  .login-panel :deep(.el-input__inner) {
    font-size: 16px;
  }
}
</style>
