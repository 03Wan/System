import { buildApiResponse, supabase, toApiError } from "./supabase";

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "files";

function getCurrentUserId() {
  const raw = localStorage.getItem("user_info");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.id || null;
  } catch {
    return null;
  }
}

function buildTaskNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(16).slice(2, 8);
  return `TASK-${ts}-${rand}`;
}

function getFileExt(name) {
  const n = String(name || "");
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i).toLowerCase() : "";
}

async function resolveTemplateId(explicitTemplateId) {
  if (explicitTemplateId) return explicitTemplateId;
  const { data, error } = await supabase
    .from("format_template")
    .select("id, is_default")
    .eq("status", 1)
    .order("is_default", { ascending: false })
    .order("id", { ascending: true })
    .limit(1);
  if (error) throw toApiError(error.message, 500);
  if (!data?.length) throw toApiError("未找到可用模板", 400);
  return data[0].id;
}

async function getLatestSourceFile(paperId) {
  const { data, error } = await supabase
    .from("file_record")
    .select("id, original_name, stored_name, storage_path, mime_type, file_ext, file_size")
    .eq("paper_id", paperId)
    .eq("file_type", "PAPER_ORIGINAL")
    .eq("is_deleted", 0)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data) throw toApiError("未找到原始文档文件", 404);
  return data;
}

function parseStoragePath(path) {
  const p = String(path || "").replace(/^\/+/, "");
  if (!p) return "";
  if (p.startsWith(`${STORAGE_BUCKET}/`)) return p.slice(STORAGE_BUCKET.length + 1);
  return p;
}

async function deleteFileRecordWithFallback(fileId) {
  const { error } = await supabase.from("file_record").delete().eq("id", fileId);
  if (!error) return { hard_deleted: true };
  if (String(error.code || "") !== "23503") throw toApiError(error.message, 500);

  const now = new Date().toISOString();
  const { error: softError } = await supabase
    .from("file_record")
    .update({ is_deleted: 1, updated_at: now, storage_path: "" })
    .eq("id", fileId);
  if (softError) throw toApiError(softError.message, 500);
  return { hard_deleted: false, soft_deleted: true };
}

async function downloadStorageByRecord(fileRecord) {
  const objectPath = parseStoragePath(fileRecord.storage_path);
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(objectPath);
  if (error) throw toApiError(error.message, 500);
  return data;
}

function blobResponse(blob, fileName) {
  const safeName = String(fileName || "download.bin");
  return {
    data: blob,
    headers: {
      "content-disposition": `attachment; filename="${encodeURIComponent(safeName)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    }
  };
}

function normalizeDetectionResult(value) {
  if (Array.isArray(value)) return value[0] || {};
  return value || {};
}

export function uploadPaperApi(formData) {
  return uploadPaperBySupabase(formData);
}

export function detectPaperApi(paperId, payload = {}) {
  return detectPaperBySupabase(paperId, payload);
}

export function getReportApi(taskId) {
  return getReportBySupabase(taskId);
}

export function autoFormatApi(paperId, payload = {}) {
  return autoFormatBySupabase(paperId, payload);
}

export function getHistoryApi(params = {}) {
  return getHistoryBySupabase(params);
}

export function getUserStatsApi() {
  return getUserStatsBySupabase();
}

export function getTemplateOptionsApi() {
  return getTemplateOptionsBySupabase();
}

export async function downloadFileBlobApi(fileId) {
  const { data, error } = await supabase
    .from("file_record")
    .select("id, original_name, storage_path")
    .eq("id", fileId)
    .eq("is_deleted", 0)
    .maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data) throw toApiError("文件不存在", 404);
  const blob = await downloadStorageByRecord(data);
  return blobResponse(blob, data.original_name || `file_${fileId}.bin`);
}

export async function downloadReportExcelByTaskApi(taskId) {
  const { data, error } = await supabase
    .from("detection_result")
    .select("report_file_id")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data?.report_file_id) throw toApiError("当前任务没有可下载的 Excel 报告", 404);
  return downloadFileBlobApi(data.report_file_id);
}

export async function deleteFileApi(fileId) {
  const { data, error } = await supabase
    .from("file_record")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("is_deleted", 0)
    .maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data) throw toApiError("文件不存在", 404);

  const objectPath = parseStoragePath(data.storage_path);
  if (objectPath) {
    const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (removeError) throw toApiError(removeError.message, 500);
  }

  const result = await deleteFileRecordWithFallback(fileId);
  return buildApiResponse(result);
}

async function uploadPaperBySupabase(formData) {
  const userId = getCurrentUserId();
  if (!userId) throw toApiError("请先登录", 401);

  const title = String(formData?.get?.("title") || "").trim();
  const abstractText = String(formData?.get?.("abstract_text") || "").trim();
  const keywords = String(formData?.get?.("keywords") || "").trim();
  const file = formData?.get?.("file");

  if (!title) throw toApiError("请先输入文档标题", 400);
  if (!file) throw toApiError("请先选择 .docx 文件", 400);
  if (!/\.docx$/i.test(file.name || "")) throw toApiError("仅支持 .docx 文件", 400);

  const { data: paper, error: paperError } = await supabase
    .from("paper")
    .insert({
      author_id: userId,
      title,
      abstract_text: abstractText || null,
      keywords: keywords || null,
      status: "DRAFT",
      current_version: 1
    })
    .select("id")
    .single();
  if (paperError) throw toApiError(paperError.message, 500);

  const ext = getFileExt(file.name);
  const storedName = `${crypto.randomUUID()}${ext || ".docx"}`;
  const objectPath = `papers/${storedName}`;
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, file, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false
  });
  if (uploadError) {
    await supabase.from("paper").delete().eq("id", paper.id);
    throw toApiError(uploadError.message, 500);
  }

  const { data: fileRecord, error: fileError } = await supabase
    .from("file_record")
    .insert({
      uploader_id: userId,
      paper_id: paper.id,
      file_type: "PAPER_ORIGINAL",
      original_name: file.name,
      stored_name: storedName,
      storage_path: objectPath,
      file_ext: ext || ".docx",
      mime_type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size: file.size || 0,
      is_deleted: 0
    })
    .select("id")
    .single();
  if (fileError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    await supabase.from("paper").delete().eq("id", paper.id);
    throw toApiError(fileError.message, 500);
  }

  return buildApiResponse({
    paper_id: paper.id,
    source_file_id: fileRecord.id
  });
}

async function detectPaperBySupabase(paperId, payload) {
  const userId = getCurrentUserId();
  if (!userId) throw toApiError("请先登录", 401);
  if (!paperId) throw toApiError("缺少文档ID", 400);

  const sourceFile = await getLatestSourceFile(paperId);
  const templateId = await resolveTemplateId(payload?.template_id);
  const taskNo = buildTaskNo();

  const { data: task, error: taskError } = await supabase
    .from("detection_task")
    .insert({
      task_no: taskNo,
      paper_id: Number(paperId),
      submitter_id: userId,
      template_id: templateId,
      source_file_id: sourceFile.id,
      task_type: "FORMAT_CHECK",
      status: "RUNNING",
      priority: 5,
      progress: 10,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (taskError) throw toApiError(taskError.message, 500);

  const { data: detectData, error: detectError } = await supabase.functions.invoke("detect-format", {
    body: { task_id: task.id }
  });
  if (detectError) {
    await supabase
      .from("detection_task")
      .update({
        status: "FAILED",
        progress: 100,
        error_message: detectError.message || "调用检测函数失败",
        finished_at: new Date().toISOString()
      })
      .eq("id", task.id);
    throw toApiError(detectError.message || "检测失败，请检查 Edge Function 部署与密钥配置", 500);
  }

  const metrics = detectData?.data || detectData || {};

  return buildApiResponse({
    task_id: task.id,
    task_no: taskNo,
    score: Number(metrics.total_score || 0),
    pass_flag: Number(metrics.pass_flag || 0)
  });
}

async function autoFormatBySupabase(paperId) {
  const userId = getCurrentUserId();
  if (!userId) throw toApiError("请先登录", 401);
  if (!paperId) throw toApiError("缺少文档ID", 400);

  const sourceFile = await getLatestSourceFile(paperId);
  const blob = await downloadStorageByRecord(sourceFile);

  const ext = getFileExt(sourceFile.original_name || sourceFile.stored_name);
  const storedName = `${crypto.randomUUID()}${ext || ".docx"}`;
  const objectPath = `formatted/${storedName}`;
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, blob, {
    contentType: sourceFile.mime_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false
  });
  if (uploadError) throw toApiError(uploadError.message, 500);

  const outputName = `formatted_${sourceFile.original_name || sourceFile.stored_name || storedName}`;
  const { data: fileRecord, error: fileError } = await supabase
    .from("file_record")
    .insert({
      uploader_id: userId,
      paper_id: Number(paperId),
      file_type: "PAPER_PROCESSED",
      original_name: outputName,
      stored_name: storedName,
      storage_path: objectPath,
      file_ext: getFileExt(outputName) || ".docx",
      mime_type: sourceFile.mime_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size: blob.size || sourceFile.file_size || 0,
      is_deleted: 0
    })
    .select("id")
    .single();
  if (fileError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    throw toApiError(fileError.message, 500);
  }

  return buildApiResponse({
    output_file_id: fileRecord.id,
    download_url: `/api/files/${fileRecord.id}/download`
  });
}

async function getHistoryBySupabase() {
  const userId = getCurrentUserId();
  if (!userId) throw toApiError("请先登录", 401);

  const { data, error } = await supabase
    .from("detection_task")
    .select("id, task_no, paper_id, status, created_at, detection_result(total_score, pass_flag)")
    .eq("submitter_id", userId)
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw toApiError(error.message, 500);

  const list = (data || []).map((row) => {
    const dr = normalizeDetectionResult(row.detection_result);
    return {
      task_id: row.id,
      task_no: row.task_no,
      paper_id: row.paper_id,
      score: Number(dr.total_score || 0),
      pass_flag: Number(dr.pass_flag || 0),
      status: row.status,
      created_at: row.created_at
    };
  });
  return buildApiResponse({ list });
}

async function getUserStatsBySupabase() {
  const userId = getCurrentUserId();
  if (!userId) throw toApiError("请先登录", 401);

  const { data, error } = await supabase
    .from("detection_task")
    .select("id, detection_result(total_score, pass_flag)")
    .eq("submitter_id", userId);
  if (error) throw toApiError(error.message, 500);

  const rows = data || [];
  const taskCount = rows.length;
  const scores = rows
    .map((r) => Number(normalizeDetectionResult(r.detection_result).total_score || 0))
    .filter((n) => !Number.isNaN(n));
  const avgScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
  const passCount = rows.filter((r) => Number(normalizeDetectionResult(r.detection_result).pass_flag || 0) === 1).length;
  const passRate = taskCount ? Number(((passCount / taskCount) * 100).toFixed(1)) : 0;

  return buildApiResponse({
    task_count: taskCount,
    avg_score: avgScore,
    pass_rate: passRate
  });
}

async function getTemplateOptionsBySupabase() {
  const { data, error } = await supabase
    .from("format_template")
    .select("id, template_name, version_no, is_default, status")
    .eq("status", 1)
    .order("is_default", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({ list: data || [] });
}

async function getReportBySupabase(taskId) {
  const raw = String(taskId || "").trim();
  if (!raw) throw toApiError("缺少任务ID", 400);

  let query = supabase
    .from("detection_task")
    .select("id, task_no, paper_id, status, finished_at, detection_result(total_score, pass_flag, error_count, warning_count, info_count, detail_json, report_file_id, completed_at)")
    .limit(1);

  if (/^\d+$/.test(raw)) query = query.eq("id", Number(raw));
  else query = query.eq("task_no", raw);

  const { data, error } = await query.maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data) throw toApiError("任务不存在", 404);

  const dr = normalizeDetectionResult(data.detection_result);
  const details = dr.detail_json || {};
  const issues = Array.isArray(details) ? details : Array.isArray(details.issues) ? details.issues : [];

  return buildApiResponse({
    task_id: data.id,
    task_no: data.task_no,
    paper_id: data.paper_id,
    status: data.status,
    total_score: Number(dr.total_score || 0),
    pass_flag: Number(dr.pass_flag || 0),
    error_count: Number(dr.error_count || 0),
    warning_count: Number(dr.warning_count || 0),
    info_count: Number(dr.info_count || 0),
    details: { issues },
    report_file_id: dr.report_file_id || null,
    report_files: [],
    completed_at: dr.completed_at || data.finished_at
  });
}
