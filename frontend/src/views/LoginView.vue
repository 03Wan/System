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
      <div class="hero">
        <div class="hero-badge">文档排版助手</div>
        <h1>智能文档排版审查系统</h1>
        <p>
          聚焦各类文档排版规范，覆盖检测、诊断与自动优化流程，
          帮你更快提交符合要求的规范文档。
        </p>
        <ul class="hero-list">
          <li>按模板自动检测字体、字号、行距、页边距与标题层级</li>
          <li>检测结果定位到问题项，便于快速修改与二次检查</li>
          <li>一键生成排版优化文件，保留原文不覆盖</li>
        </ul>
        <div class="hero-foot">支持 Word `.docx` 文档上传、检测与优化导出</div>
      </div>

      <div class="login-card">
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
            <el-button link type="primary" @click="registerVisible = true">立即注册</el-button>
            <el-button link @click="forgotVisible = true">忘记密码</el-button>
          </div>
        </el-form>
      </div>
    </div>

    <el-dialog v-model="registerVisible" title="用户注册" width="460px">
      <el-form :model="registerForm" label-width="90px">
        <el-form-item label="用户名" required>
          <el-input v-model="registerForm.username" placeholder="至少 3 位" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="registerForm.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="registerForm.real_name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="邮箱" required>
          <el-input v-model="registerForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="registerForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerVisible = false">取消</el-button>
        <el-button type="primary" :loading="registerLoading" @click="onRegister">注册</el-button>
      </template>
    </el-dialog>

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
import { forgotPasswordApi, loginApi, registerApi } from "../api/auth";
import { useAuthStore } from "../stores/auth";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ username: "", password: "" });
const registerVisible = ref(false);
const forgotVisible = ref(false);
const registerLoading = ref(false);
const forgotLoading = ref(false);
const registerForm = reactive({ username: "", password: "", real_name: "", email: "", phone: "" });
const forgotForm = reactive({ username: "", email: "", phone: "", new_password: "" });
const { theme, initTheme, toggleTheme } = useTheme();

onMounted(() => {
  initTheme();
});

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
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  const username = String(registerForm.username || "").trim();
  const password = String(registerForm.password || "").trim();
  const realName = String(registerForm.real_name || "").trim();
  const email = String(registerForm.email || "").trim();
  const phone = String(registerForm.phone || "").trim();

  if (!username || !password || !realName || !email || !phone) {
    ElMessage.warning("用户名、密码、姓名、邮箱、手机号均为必填");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ElMessage.warning("邮箱格式不正确");
    return;
  }
  if (!/^1\d{10}$/.test(phone)) {
    ElMessage.warning("手机号格式不正确，请输入 11 位手机号");
    return;
  }

  registerForm.username = username;
  registerForm.password = password;
  registerForm.real_name = realName;
  registerForm.email = email;
  registerForm.phone = phone;

  registerLoading.value = true;
  try {
    await registerApi(registerForm);
    ElMessage.success("注册成功，请使用新账号登录");
    form.username = registerForm.username;
    form.password = "";
    registerVisible.value = false;
    Object.assign(registerForm, { username: "", password: "", real_name: "", email: "", phone: "" });
  } finally {
    registerLoading.value = false;
  }
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
  padding: 22px;
}

.theme-switch {
  position: fixed;
  right: 26px;
  top: 22px;
  border-radius: 999px;
  padding: 9px 14px;
  z-index: 30;
}

.login-shell {
  width: min(1140px, 94vw);
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  overflow: hidden;
  min-height: 620px;
  border-radius: 24px;
}

.hero {
  padding: 52px 48px;
  background: var(--login-hero-bg);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--brand);
  background: color-mix(in srgb, var(--glass-bg-soft) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent);
  margin-bottom: 12px;
}

.hero h1 {
  margin: 0;
  font-size: 44px;
  line-height: 1.12;
  letter-spacing: 0.3px;
  color: var(--text-strong);
}

.hero p {
  margin: 18px 0 0;
  color: var(--muted-2);
  font-size: 18px;
  line-height: 1.76;
}

.hero-list {
  margin: 24px 0 0;
  padding-left: 22px;
  line-height: 1.86;
  color: var(--text);
  font-size: 16px;
}

.hero-list li + li {
  margin-top: 10px;
}

.hero-foot {
  margin-top: 18px;
  color: var(--muted);
  font-size: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(130, 154, 190, 0.45);
}

.login-card {
  padding: 54px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--glass-bg-soft);
  border-left: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  color: var(--text);
}

.login-card h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: 0.2px;
  color: var(--text-strong);
}

.hint {
  margin: 10px 0 22px;
  color: var(--muted-2);
}

.actions {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 18px;
}

.login-card :deep(.el-form-item__label) {
  color: var(--muted);
}

.login-card :deep(.el-input__wrapper) {
  background: color-mix(in srgb, var(--glass-bg) 86%, transparent) !important;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 85%, transparent) !important;
  box-shadow: none !important;
}

.login-card :deep(.el-input__inner) {
  color: var(--text-strong) !important;
}

.login-card :deep(.el-input__inner::placeholder) {
  color: var(--muted-2) !important;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero {
    padding: 28px 22px 24px;
  }

  .hero h1 {
    font-size: 30px;
  }

  .hero p,
  .hero-list {
    font-size: 17px;
  }

  .login-card {
    padding: 24px 20px 22px;
    justify-content: flex-start;
  }
}
</style>
