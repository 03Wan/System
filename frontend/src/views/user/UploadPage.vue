<template>
  <div class="page upload-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">文档上传与检测</h2>
        <div class="page-sub">上传 Word 文档后，可发起检测和一键排版。</div>
      </div>
    </div>

    <el-card class="card panel-pad flow-card">
      <div class="subsection-title">执行流程</div>
      <el-steps :active="flowStep" finish-status="success" simple>
        <el-step title="上传文档" />
        <el-step title="开始检测" />
        <el-step title="导出排版文件" />
      </el-steps>
    </el-card>

    <div class="content-grid two upload-grid">
      <el-card class="card panel-pad">
        <div class="section-title">上传信息</div>
        <div class="panel-sub">建议先选择模板，再上传并检测。</div>

        <el-form :model="form" label-width="110px">
          <el-form-item label="文档标题">
            <el-input v-model="form.title" placeholder="请输入文档标题" />
          </el-form-item>

          <el-form-item label="摘要">
            <el-input v-model="form.abstract_text" type="textarea" :rows="3" placeholder="可选" />
          </el-form-item>

          <el-form-item label="关键词">
            <el-input v-model="form.keywords" placeholder="多个关键词用逗号分隔" />
          </el-form-item>

          <el-form-item label="检测模板">
            <el-select v-model="form.template_id" placeholder="请选择模板" style="width: 100%">
              <el-option
                v-for="item in templateOptions"
                :key="item.id"
                :label="`${item.template_name} (${item.version_no})`"
                :value="item.id"
              />
            </el-select>
            <div v-if="!templateOptions.length" class="muted" style="margin-top: 6px">暂无可用模板，请联系管理员配置。</div>
          </el-form-item>

          <el-form-item label="文档文件">
            <el-upload
              drag
              :auto-upload="false"
              :show-file-list="true"
              :limit="1"
              accept=".docx"
              :on-change="onFileChange"
              :on-remove="onFileRemove"
            >
              <div>拖拽或点击上传 .docx 文件</div>
            </el-upload>
          </el-form-item>

          <el-space wrap class="action-row">
            <el-button type="primary" :loading="uploading" @click="submitUpload">上传文档</el-button>
            <el-button type="success" :disabled="!paperId" :loading="detecting" @click="startDetect">开始检测</el-button>
            <el-button :disabled="!paperId" :loading="formatting" @click="startFormat">一键排版</el-button>
          </el-space>
        </el-form>
      </el-card>

      <div class="content-grid side-panels">
        <el-card class="card panel-pad">
          <div class="panel-head">
            <div class="section-title">任务状态</div>
            <el-tag :type="flowStep >= 2 ? 'success' : flowStep === 1 ? 'warning' : 'info'">
              {{ flowStep >= 2 ? "检测已完成" : flowStep === 1 ? "已上传待检测" : "待上传" }}
            </el-tag>
          </div>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="paper_id">{{ paperId || "-" }}</el-descriptions-item>
            <el-descriptions-item label="task_id">{{ taskId || "-" }}</el-descriptions-item>
            <el-descriptions-item label="排版下载">{{ formattedDownloadUrl || "-" }}</el-descriptions-item>
          </el-descriptions>

          <el-space style="margin-top: 12px">
            <el-button v-if="taskId" @click="$router.push(`/user/result?task_id=${taskId}`)">查看检测结果</el-button>
            <el-button v-if="formattedDownloadUrl" type="primary" plain :loading="downloadingFormatted" @click="downloadFormattedFile">
              下载排版文件
            </el-button>
            <el-button v-if="formattedDownloadUrl" type="danger" plain :loading="deletingFormatted" @click="deleteFormattedFile">
              删除排版文件
            </el-button>
          </el-space>
        </el-card>

        <el-card class="card panel-pad">
          <div class="section-title">操作提示</div>
          <el-alert type="info" :closable="false" title="检测失败时会显示具体错误（例如函数未部署或权限不足）。" />
          <el-alert style="margin-top: 10px" type="success" :closable="false" title="一键排版不会覆盖原文，会生成新文件。" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { autoFormatApi, deleteFileApi, detectPaperApi, downloadFileBlobApi, getTemplateOptionsApi, uploadPaperApi } from "../../api/paper";

const form = reactive({
  title: "",
  abstract_text: "",
  keywords: "",
  template_id: null
});

const selectedFile = ref(null);
const paperId = ref(null);
const taskId = ref(null);
const formattedDownloadUrl = ref("");
const formattedFileId = ref(null);
const templateOptions = ref([]);

const uploading = ref(false);
const detecting = ref(false);
const formatting = ref(false);
const downloadingFormatted = ref(false);
const deletingFormatted = ref(false);

const flowStep = computed(() => {
  if (formattedDownloadUrl.value) return 3;
  if (taskId.value) return 2;
  if (paperId.value) return 1;
  return 0;
});

onMounted(async () => {
  try {
    const res = await getTemplateOptionsApi();
    templateOptions.value = res?.data?.list || [];
    const defaultItem = templateOptions.value.find((i) => i.is_default === 1);
    form.template_id = defaultItem ? defaultItem.id : templateOptions.value[0]?.id || null;
  } catch {
    templateOptions.value = [];
  }
});

function parseErrorMessage(error, fallback = "操作失败，请稍后重试") {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
}

function onFileChange(file) {
  selectedFile.value = file.raw;
}

function onFileRemove() {
  selectedFile.value = null;
}

async function submitUpload() {
  if (!form.title) {
    ElMessage.warning("请先输入文档标题");
    return;
  }
  if (!selectedFile.value) {
    ElMessage.warning("请先选择 .docx 文件");
    return;
  }

  const fd = new FormData();
  fd.append("title", form.title);
  fd.append("abstract_text", form.abstract_text || "");
  fd.append("keywords", form.keywords || "");
  fd.append("file", selectedFile.value);

  uploading.value = true;
  try {
    const res = await uploadPaperApi(fd);
    paperId.value = res.data.paper_id;
    ElMessage.success("上传成功");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "上传失败，请稍后重试"));
  } finally {
    uploading.value = false;
  }
}

async function startDetect() {
  if (!paperId.value) {
    ElMessage.warning("请先上传文档");
    return;
  }

  detecting.value = true;
  try {
    const payload = form.template_id ? { template_id: form.template_id } : {};
    const res = await detectPaperApi(paperId.value, payload);
    taskId.value = res.data.task_id;
    saveTaskRecord(res.data.task_id, paperId.value, res.data.score, res.data.pass_flag);
    ElMessage.success("检测完成，可在检测结果页查看并下载报告");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "检测失败，请检查 Edge Function 是否已部署"));
  } finally {
    detecting.value = false;
  }
}

async function startFormat() {
  if (!paperId.value) {
    ElMessage.warning("请先上传文档");
    return;
  }

  formatting.value = true;
  try {
    const res = await autoFormatApi(paperId.value, {});
    formattedFileId.value = res.data.output_file_id || null;
    formattedDownloadUrl.value = `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5001"}${res.data.download_url}`;
    ElMessage.success("一键排版完成");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "一键排版失败，请稍后重试"));
  } finally {
    formatting.value = false;
  }
}

function parseFileIdFromUrl(url) {
  const value = String(url || "");
  const match = value.match(/\/api\/files\/(\d+)\/download/);
  return match ? Number(match[1]) : null;
}

async function downloadFormattedFile() {
  const fileId = formattedFileId.value || parseFileIdFromUrl(formattedDownloadUrl.value);
  if (!fileId) {
    ElMessage.warning("当前没有可下载的排版文件");
    return;
  }

  downloadingFormatted.value = true;
  try {
    const resp = await downloadFileBlobApi(fileId);
    const blob = resp.data;
    if (!blob || blob.size === 0) {
      ElMessage.error("下载失败：空文件");
      return;
    }

    const disposition = resp.headers?.["content-disposition"] || "";
    const utf8NameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const fallbackName = `formatted_${paperId.value || "paper"}.docx`;
    const fileName = decodeURIComponent((utf8NameMatch?.[1] || plainNameMatch?.[1] || fallbackName).trim());

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    ElMessage.success("排版文件下载成功");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "排版文件下载失败，请稍后重试"));
  } finally {
    downloadingFormatted.value = false;
  }
}

async function deleteFormattedFile() {
  const fileId = formattedFileId.value || parseFileIdFromUrl(formattedDownloadUrl.value);
  if (!fileId) {
    ElMessage.warning("当前没有可删除的排版文件");
    return;
  }

  await ElMessageBox.confirm("确认删除该排版文件吗？删除后无法下载。", "提示", { type: "warning" });

  deletingFormatted.value = true;
  try {
    await deleteFileApi(fileId);
    formattedFileId.value = null;
    formattedDownloadUrl.value = "";
    ElMessage.success("排版文件已删除");
  } catch (error) {
    ElMessage.error(parseErrorMessage(error, "排版文件删除失败，请稍后重试"));
  } finally {
    deletingFormatted.value = false;
  }
}

function saveTaskRecord(taskIdValue, paperIdValue, score, passFlag) {
  const records = JSON.parse(localStorage.getItem("detect_history") || "[]");
  records.unshift({
    task_id: taskIdValue,
    paper_id: paperIdValue,
    score,
    pass_flag: passFlag,
    created_at: new Date().toISOString()
  });
  localStorage.setItem("detect_history", JSON.stringify(records.slice(0, 200)));
}
</script>

<style scoped>
.upload-page :deep(.page-sub) {
  color: #4f6484;
  font-weight: 500;
}

.upload-grid {
  align-items: start;
  margin-top: 14px;
}

.flow-card {
  margin-bottom: 14px;
}

.side-panels {
  gap: 12px;
}

.action-row {
  margin-top: 8px;
  width: 100%;
}

.action-row :deep(.el-button) {
  min-width: 120px;
}

.upload-page :deep(.el-upload-dragger) {
  width: 100%;
  min-height: 126px;
  border-radius: 14px;
  border-style: dashed;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.upload-page :deep(.el-upload) {
  width: 100%;
  display: block;
}

.upload-page :deep(.el-descriptions) {
  border-radius: 12px;
  overflow: hidden;
}

.upload-page :deep(.el-form-item__label) {
  color: #364f74 !important;
  font-weight: 600;
}

.upload-page :deep(.el-upload-dragger .el-upload__text) {
  color: #2f476b !important;
  font-weight: 500;
  line-height: 1.6;
}

.upload-page :deep(.el-descriptions__label) {
  color: #334f77 !important;
  font-weight: 700;
}

.upload-page :deep(.el-alert__title) {
  font-weight: 600;
  line-height: 1.55;
}

.upload-page :deep(.section-title) {
  letter-spacing: 0.2px;
}

@media (max-width: 1024px) {
  .action-row :deep(.el-button) {
    flex: 1;
    min-width: 110px;
  }
}
</style>
