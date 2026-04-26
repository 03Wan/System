<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">用户管理</h2>
        <div class="page-sub">管理系统用户、角色与账号状态。</div>
      </div>
    </div>

    <el-card class="card panel-pad">
      <el-row :gutter="10" class="mini-metrics">
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="用户总数" :value="rows.length" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="管理员" :value="adminCount" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="普通用户" :value="userCount" /></el-col>
        <el-col :xs="12" :sm="8" :md="6"><el-statistic title="已启用" :value="enabledCount" /></el-col>
      </el-row>

      <div class="toolbar">
        <el-input v-model="keyword" clearable placeholder="按用户名/姓名搜索" style="max-width: 280px" />
        <el-select v-model="roleFilter" clearable placeholder="角色筛选" style="width: 140px">
          <el-option label="用户" value="USER" />
          <el-option label="管理员" value="ADMIN" />
        </el-select>
        <el-button type="primary" @click="openCreate">新增用户</el-button>
        <el-button :loading="loading" @click="loadUsers">刷新</el-button>
      </div>

      <div class="table-wrap">
        <el-table :data="filteredRows" border stripe max-height="720">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="real_name" label="姓名" min-width="130" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? 'warning' : 'info'">{{ row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">{{ row.status === 1 ? "启用" : "禁用" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        </el-table>
      </div>
      <div v-if="!filteredRows.length" class="empty-wrap" style="margin-top: 10px">
        <el-empty description="暂无匹配用户，试试清空筛选或新增用户" :image-size="66" />
      </div>
      <div class="muted" style="margin-top: 8px">共 {{ filteredRows.length }} 条</div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑用户' : '新增用户'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="Boolean(form.id)" />
        </el-form-item>
        <el-form-item label="密码" v-if="!form.id">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="用户" value="USER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="statusBool" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { createUserApi, deleteUserApi, getUsersApi, updateUserApi } from "../../api/admin";

const loading = ref(false);
const rows = ref([]);
const dialogVisible = ref(false);
const keyword = ref("");
const roleFilter = ref("");

const form = reactive({
  id: null,
  username: "",
  password: "",
  real_name: "",
  email: "",
  phone: "",
  role: "USER",
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
  return rows.value.filter((r) => {
    const hitKey = !key || r.username?.toLowerCase().includes(key) || r.real_name?.toLowerCase().includes(key);
    const hitRole = !roleFilter.value || r.role === roleFilter.value;
    return hitKey && hitRole;
  });
});

const adminCount = computed(() => rows.value.filter((r) => r.role === "ADMIN").length);
const userCount = computed(() => rows.value.filter((r) => r.role === "USER").length);
const enabledCount = computed(() => rows.value.filter((r) => r.status === 1).length);

onMounted(() => {
  loadUsers();
});

async function loadUsers() {
  loading.value = true;
  try {
    const res = await getUsersApi();
    rows.value = res?.data?.list || [];
  } catch (error) {
    rows.value = [];
    ElMessage.error(error?.response?.data?.message || error?.message || "用户数据加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, {
    id: null,
    username: "",
    password: "",
    real_name: "",
    email: "",
    phone: "",
    role: "USER",
    status: 1
  });
  dialogVisible.value = true;
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    username: row.username,
    password: "",
    real_name: row.real_name || "",
    email: row.email || "",
    phone: row.phone || "",
    role: row.role,
    status: row.status
  });
  dialogVisible.value = true;
}

async function save() {
  try {
    if (form.id) {
      await updateUserApi(form.id, form);
    } else {
      await createUserApi(form);
    }
    ElMessage.success("保存成功");
    dialogVisible.value = false;
    loadUsers();
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || "保存失败");
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除用户 ${row.username} 吗？`, "提示", { type: "warning" });
  await deleteUserApi(row.id);
  ElMessage.success("删除成功");
  loadUsers();
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

.table-wrap :deep(.el-table__body-wrapper) {
  max-height: 620px;
}
</style>
