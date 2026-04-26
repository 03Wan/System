import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb"
    }
  }
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.VITE_SUPABASE_STORAGE_BUCKET || "files";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message || "璇锋眰澶辫触");
    this.status = status;
  }
}

function ok(res, data = {}) {
  res.status(200).json({ code: 0, message: "ok", data });
}

function fail(res, error) {
  const status = Number(error?.status || 500);
  const message = error?.message || "鏈嶅姟寮傚父锛岃绋嶅悗閲嶈瘯";
  res.status(status).json({ code: status, message });
}

async function writeSystemLog(payload = {}) {
  try {
    await supabase.from("system_log").insert({
      user_id: payload.user_id ?? null,
      log_type: payload.log_type || "SYSTEM",
      module: payload.module || "system",
      action: payload.action || "unknown",
      target_type: payload.target_type || null,
      target_id: payload.target_id || null,
      level: payload.level || "INFO",
      message: payload.message || "",
      detail_json: payload.detail_json || {}
    });
  } catch {
    // ignore log write errors
  }
}

function getAuth(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const headerUserId = String(req.headers["x-user-id"] || "").trim();
  const role = String(req.headers["x-user-role"] || "USER").toUpperCase();

  let userId = headerUserId ? Number(headerUserId) : null;
  if (!userId && token.startsWith("sb-local-")) {
    const m = token.match(/^sb-local-(\d+)-/);
    if (m) userId = Number(m[1]);
  }
  return { token, userId: Number.isFinite(userId) ? userId : null, role, user: null };
}

async function hydrateAuth(auth) {
  if (!auth?.userId) return auth;
  const { data, error } = await supabase
    .from("sys_user")
    .select("id, username, role, real_name, email, phone, status, deleted_at")
    .eq("id", auth.userId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data || data.deleted_at || Number(data.status) !== 1) return { ...auth, user: null };
  return { ...auth, role: String(data.role || "USER").toUpperCase(), user: data };
}

function requireLogin(auth) {
  if (!auth?.user?.id) throw new ApiError("Please login first", 401);
  return auth.user.id;
}

function requireAdmin(auth) {
  requireLogin(auth);
  if (String(auth.user?.role || "").toUpperCase() !== "ADMIN") throw new ApiError("Permission denied", 403);
}

function ensureSupabaseEnv() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new ApiError("Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", 500);
  }
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }
  }
  return {};
}

function getFileExt(name) {
  const n = String(name || "");
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i).toLowerCase() : "";
}

function parseStoragePath(path) {
  const p = String(path || "").replace(/^\/+/, "");
  if (!p) return "";
  if (p.startsWith(`${STORAGE_BUCKET}/`)) return p.slice(STORAGE_BUCKET.length + 1);
  return p;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/["\n,\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeDetectionResult(value) {
  if (Array.isArray(value)) return value[0] || {};
  return value || {};
}

function parseFunctionInvokeErrorMessage(invokeError) {
  const fallback = invokeError?.message || "??????????";
  const context = invokeError?.context;
  if (!context) return fallback;
  return fallback;
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
  if (error) throw new ApiError(error.message, 500);
  if (!data?.length) throw new ApiError("No available template found", 400);
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
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("Source document not found", 404);
  return data;
}

async function deleteWithFallback(table, id, patch = {}) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (!error) return { hard_deleted: true };
  if (String(error.code || "") !== "23503") throw new ApiError(error.message, 500);

  const { error: softError } = await supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (softError) throw new ApiError(softError.message, 500);
  return { hard_deleted: false, soft_deleted: true };
}

async function downloadStorageByRecord(fileRecord) {
  const objectPath = parseStoragePath(fileRecord.storage_path);
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(objectPath);
  if (error) throw new ApiError(error.message, 500);
  return data;
}

async function handleAuthLogin(req, res) {
  const payload = parseJsonBody(req);
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");
  if (!username || !password) throw new ApiError("Username and password are required", 400);

  const { data, error } = await supabase
    .from("sys_user")
    .select("id, username, password_hash, role, real_name, email, phone, status")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("Account does not exist", 404);
  if (Number(data.status) !== 1) throw new ApiError("Account is disabled", 403);
  if (String(data.password_hash || "") !== password) throw new ApiError("Wrong password", 401);

  const loginAt = new Date().toISOString();
  const [userUpdateResult, logInsertResult] = await Promise.all([
    supabase.from("sys_user").update({ last_login_at: loginAt, updated_at: loginAt }).eq("id", data.id),
    supabase.from("system_log").insert({
      user_id: data.id,
      log_type: "LOGIN",
      module: "auth",
      action: "login",
      target_type: "user",
      target_id: String(data.id),
      level: "INFO",
      message: "User login success",
      detail_json: { username: data.username, source: "vercel-api" }
    })
  ]);
  if (userUpdateResult.error) throw new ApiError(userUpdateResult.error.message, 500);
  if (logInsertResult.error) throw new ApiError(logInsertResult.error.message, 500);

  const accessToken = `sb-local-${data.id}-${Date.now()}`;
  ok(res, {
    access_token: accessToken,
    user: {
      id: data.id,
      username: data.username,
      role: data.role || "USER",
      real_name: data.real_name || "",
      email: data.email || "",
      phone: data.phone || "",
      status: data.status
    }
  });
}

async function handleAuthRegister(req, res) {
  const payload = parseJsonBody(req);
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "").trim();
  if (!username || !password) throw new ApiError("Username and password are required", 400);

  const insertPayload = {
    username,
    password_hash: password,
    role: "USER",
    real_name: payload?.real_name || null,
    email: payload?.email || null,
    phone: payload?.phone || null,
    status: 1
  };

  const { error } = await supabase.from("sys_user").insert(insertPayload);
  if (error) {
    if (/duplicate key|unique/i.test(error.message || "")) throw new ApiError("Username/email/phone already exists", 409);
    throw new ApiError(error.message, 500);
  }
  await writeSystemLog({
    log_type: "CREATE",
    module: "auth",
    action: "register",
    target_type: "user",
    target_id: username,
    message: "用户注册成功",
    detail_json: { username }
  });
  ok(res, {});
}

async function handleAuthForgot(req, res) {
  const payload = parseJsonBody(req);
  const username = String(payload?.username || "").trim();
  const email = String(payload?.email || "").trim();
  const phone = String(payload?.phone || "").trim();
  const newPassword = String(payload?.new_password || "");
  if (!username || !newPassword) throw new ApiError("Username and new password are required", 400);
  if (!email && !phone) throw new ApiError("Email or phone is required", 400);

  let query = supabase
    .from("sys_user")
    .select("id, email, phone")
    .eq("username", username)
    .is("deleted_at", null)
    .limit(1);
  if (email) query = query.eq("email", email);
  if (phone) query = query.eq("phone", phone);

  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("Username or contact does not match", 404);

  const { error: updateError } = await supabase
    .from("sys_user")
    .update({ password_hash: newPassword, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (updateError) throw new ApiError(updateError.message, 500);
  await writeSystemLog({
    user_id: data.id,
    log_type: "UPDATE",
    module: "auth",
    action: "forgot-password",
    target_type: "user",
    target_id: String(data.id),
    message: "用户重置密码成功",
    detail_json: { username }
  });
  ok(res, {});
}

async function handleUserUpload(req, res, auth) {
  const userId = requireLogin(auth);
  const payload = parseJsonBody(req);
  const title = String(payload?.title || "").trim();
  const abstractText = String(payload?.abstract_text || "").trim();
  const keywords = String(payload?.keywords || "").trim();
  const file = payload?.file;

  if (!title) throw new ApiError("Document title is required", 400);
  if (!file?.base64 || !file?.name) throw new ApiError("Please choose a .docx file", 400);
  if (!/\.docx$/i.test(file.name || "")) throw new ApiError("Only .docx is supported", 400);

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
  if (paperError) throw new ApiError(paperError.message, 500);

  const ext = getFileExt(file.name);
  const storedName = `${randomUUID()}${ext || ".docx"}`;
  const objectPath = `papers/${storedName}`;
  const buffer = Buffer.from(String(file.base64 || ""), "base64");

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, buffer, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false
  });
  if (uploadError) {
    await supabase.from("paper").delete().eq("id", paper.id);
    throw new ApiError(uploadError.message, 500);
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
      file_size: Number(file.size || buffer.byteLength || 0),
      is_deleted: 0
    })
    .select("id")
    .single();
  if (fileError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    await supabase.from("paper").delete().eq("id", paper.id);
    throw new ApiError(fileError.message, 500);
  }

  await writeSystemLog({
    user_id: userId,
    log_type: "UPLOAD",
    module: "user",
    action: "upload",
    target_type: "paper",
    target_id: String(paper.id),
    message: "用户上传论文成功",
    detail_json: { paper_id: paper.id, source_file_id: fileRecord.id, filename: file.name }
  });
  ok(res, { paper_id: paper.id, source_file_id: fileRecord.id });
}

async function handleUserDetect(req, res, auth) {
  const userId = requireLogin(auth);
  const payload = parseJsonBody(req);
  const paperId = Number(payload?.paper_id);
  if (!paperId) throw new ApiError("paper_id is required", 400);

  const sourceFile = await getLatestSourceFile(paperId);
  const templateId = await resolveTemplateId(payload?.template_id);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const taskNo = `TASK-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(16).slice(2, 8)}`;

  const { data: task, error: taskError } = await supabase
    .from("detection_task")
    .insert({
      task_no: taskNo,
      paper_id: paperId,
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
  if (taskError) throw new ApiError(taskError.message, 500);

  const { data: detectData, error: detectError } = await supabase.functions.invoke("detect-format", {
    body: { task_id: task.id }
  });

  if (detectError) {
    const functionErrorMessage = parseFunctionInvokeErrorMessage(detectError);
    await supabase
      .from("detection_task")
      .update({
        status: "FAILED",
        progress: 100,
        error_message: functionErrorMessage || "Detect function invocation failed",
        finished_at: new Date().toISOString()
      })
      .eq("id", task.id);
    throw new ApiError(functionErrorMessage || "Detection failed, please check Edge Function deployment and keys", 500);
  }

  const metrics = detectData?.data || detectData || {};
  await writeSystemLog({
    user_id: userId,
    log_type: "DETECT",
    module: "user",
    action: "detect",
    target_type: "task",
    target_id: String(task.id),
    message: "用户发起检测成功",
    detail_json: { task_id: task.id, paper_id: paperId, score: Number(metrics.total_score || 0) }
  });
  ok(res, {
    task_id: task.id,
    task_no: taskNo,
    score: Number(metrics.total_score || 0),
    pass_flag: Number(metrics.pass_flag || 0)
  });
}

async function handleUserAutoFormat(req, res, auth) {
  const userId = requireLogin(auth);
  const payload = parseJsonBody(req);
  const paperId = Number(payload?.paper_id);
  if (!paperId) throw new ApiError("paper_id is required", 400);

  const sourceFile = await getLatestSourceFile(paperId);
  const blob = await downloadStorageByRecord(sourceFile);
  const fileBuffer = Buffer.from(await blob.arrayBuffer());

  const ext = getFileExt(sourceFile.original_name || sourceFile.stored_name);
  const storedName = `${randomUUID()}${ext || ".docx"}`;
  const objectPath = `formatted/${storedName}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, fileBuffer, {
    contentType: sourceFile.mime_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false
  });
  if (uploadError) throw new ApiError(uploadError.message, 500);

  const outputName = `formatted_${sourceFile.original_name || sourceFile.stored_name || storedName}`;
  const { data: fileRecord, error: fileError } = await supabase
    .from("file_record")
    .insert({
      uploader_id: userId,
      paper_id: paperId,
      file_type: "PAPER_PROCESSED",
      original_name: outputName,
      stored_name: storedName,
      storage_path: objectPath,
      file_ext: getFileExt(outputName) || ".docx",
      mime_type: sourceFile.mime_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size: fileBuffer.byteLength || sourceFile.file_size || 0,
      is_deleted: 0
    })
    .select("id")
    .single();
  if (fileError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    throw new ApiError(fileError.message, 500);
  }

  await writeSystemLog({
    user_id: userId,
    log_type: "CREATE",
    module: "user",
    action: "auto-format",
    target_type: "file",
    target_id: String(fileRecord.id),
    message: "用户自动排版成功",
    detail_json: { paper_id: paperId, output_file_id: fileRecord.id }
  });
  ok(res, { output_file_id: fileRecord.id, download_url: `/api/files/${fileRecord.id}/download` });
}

async function handleUserHistory(req, res, auth) {
  const userId = requireLogin(auth);
  const { data, error } = await supabase
    .from("detection_task")
    .select("id, task_no, paper_id, status, created_at, detection_result(total_score, pass_flag)")
    .eq("submitter_id", userId)
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw new ApiError(error.message, 500);

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
  ok(res, { list });
}

async function handleUserStats(req, res, auth) {
  const userId = requireLogin(auth);
  const { data, error } = await supabase
    .from("detection_task")
    .select("id, detection_result(total_score, pass_flag)")
    .eq("submitter_id", userId);
  if (error) throw new ApiError(error.message, 500);

  const rows = data || [];
  const taskCount = rows.length;
  const scores = rows
    .map((r) => Number(normalizeDetectionResult(r.detection_result).total_score || 0))
    .filter((n) => !Number.isNaN(n));
  const avgScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
  const passCount = rows.filter((r) => Number(normalizeDetectionResult(r.detection_result).pass_flag || 0) === 1).length;
  const passRate = taskCount ? Number(((passCount / taskCount) * 100).toFixed(1)) : 0;

  ok(res, { task_count: taskCount, avg_score: avgScore, pass_rate: passRate });
}

async function handleUserTemplates(req, res) {
  const { data, error } = await supabase
    .from("format_template")
    .select("id, template_name, version_no, is_default, status")
    .eq("status", 1)
    .order("is_default", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new ApiError(error.message, 500);
  ok(res, { list: data || [] });
}

async function handleUserReport(req, res) {
  const raw = String(req.query.task_id || "").trim();
  if (!raw) throw new ApiError("task_id is required", 400);

  let query = supabase
    .from("detection_task")
    .select("id, task_no, paper_id, status, finished_at, detection_result(total_score, pass_flag, error_count, warning_count, info_count, detail_json, report_file_id, completed_at)")
    .limit(1);

  if (/^\d+$/.test(raw)) query = query.eq("id", Number(raw));
  else query = query.eq("task_no", raw);

  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("Task not found", 404);

  const dr = normalizeDetectionResult(data.detection_result);
  const details = dr.detail_json || {};
  const issues = Array.isArray(details) ? details : Array.isArray(details.issues) ? details.issues : [];

  ok(res, {
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

async function handleFileDownload(req, res, fileId) {
  const { data, error } = await supabase
    .from("file_record")
    .select("id, original_name, storage_path, mime_type")
    .eq("id", fileId)
    .eq("is_deleted", 0)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("File not found", 404);

  const blob = await downloadStorageByRecord(data);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const safeName = String(data.original_name || `file_${fileId}.bin`);

  res.setHeader("Content-Type", data.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.status(200).send(buffer);
}

async function handleFileDelete(req, res, auth, fileId) {
  const userId = requireLogin(auth);
  const { data, error } = await supabase
    .from("file_record")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("is_deleted", 0)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("File not found", 404);

  const objectPath = parseStoragePath(data.storage_path);
  if (objectPath) {
    const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (removeError) throw new ApiError(removeError.message, 500);
  }

  const result = await deleteWithFallback("file_record", fileId, { is_deleted: 1, storage_path: "" });
  await writeSystemLog({
    user_id: userId,
    log_type: "DELETE",
    module: "file",
    action: "delete",
    target_type: "file",
    target_id: String(fileId),
    message: "用户删除文件成功",
    detail_json: result
  });
  ok(res, result);
}

async function handleReportExcel(req, res, taskId) {
  const { data, error } = await supabase
    .from("detection_result")
    .select("report_file_id, total_score, pass_flag, error_count, warning_count, info_count, detail_json")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500);

  if (data?.report_file_id) {
    await handleFileDownload(req, res, data.report_file_id);
    return;
  }

  const detail = data?.detail_json || {};
  const issues = Array.isArray(detail) ? detail : Array.isArray(detail.issues) ? detail.issues : [];
  const headers = [
    "浠诲姟ID",
    "鎬诲垎",
    "鏄惁閫氳繃",
    "???",
    "???",
    "???",
    "闂绫诲瀷",
    "闂鎻忚堪",
    "浣嶇疆",
    "绾у埆",
    "???",
    "??",
    "淇寤鸿"
  ];

  const rows = (issues.length ? issues : [{}]).map((it, idx) => [
    idx === 0 ? taskId : "",
    idx === 0 ? data?.total_score ?? 0 : "",
    idx === 0 ? (Number(data?.pass_flag || 0) === 1 ? "閫氳繃" : "鏈€氳繃") : "",
    idx === 0 ? data?.error_count ?? 0 : "",
    idx === 0 ? data?.warning_count ?? 0 : "",
    idx === 0 ? data?.info_count ?? 0 : "",
    it?.problem_type || "-",
    it?.problem_desc || "-",
    it?.position || "-",
    it?.severity || "-",
    it?.confidence ?? "",
    it?.issue_status || "-",
    it?.suggestion || "-"
  ]);

  const content = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const outName = `report_task_${taskId}.csv`;
  const buffer = Buffer.from(`\uFEFF${content}`, "utf8");

  res.setHeader("Content-Type", "text/csv;charset=utf-8;");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(outName)}"; filename*=UTF-8''${encodeURIComponent(outName)}`);
  res.status(200).send(buffer);
}

async function handleAdminUsers(req, res, auth) {
  requireAdmin(auth);
  if (req.method === "GET") {
    const key = String(req.query.keyword || "").trim();
    const role = String(req.query.role || "").trim();
    let query = supabase
      .from("sys_user")
      .select("id, username, role, real_name, email, phone, status, created_at")
      .is("deleted_at", null)
      .order("id", { ascending: false });
    if (role) query = query.eq("role", role);
    if (key) query = query.or(`username.ilike.%${key}%,real_name.ilike.%${key}%`);
    const { data, error } = await query;
    if (error) throw new ApiError(error.message, 500);
    ok(res, { list: data || [] });
    return;
  }

  if (req.method === "POST") {
    const payload = parseJsonBody(req);
    const insertPayload = {
      username: payload.username,
      password_hash: payload.password || "123456",
      role: payload.role || "USER",
      real_name: payload.real_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      status: payload.status ?? 1
    };
    const { error } = await supabase.from("sys_user").insert(insertPayload);
    if (error) throw new ApiError(error.message, 500);
    ok(res, {});
    return;
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function handleAdminUserById(req, res, auth, userId) {
  requireAdmin(auth);
  if (req.method === "PUT") {
    const payload = parseJsonBody(req);
    const updatePayload = {
      role: payload.role,
      real_name: payload.real_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      status: payload.status ?? 1,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("sys_user").update(updatePayload).eq("id", userId);
    if (error) throw new ApiError(error.message, 500);
    ok(res, {});
    return;
  }

  if (req.method === "DELETE") {
    const result = await deleteWithFallback("sys_user", userId, { deleted_at: new Date().toISOString(), status: 0 });
    ok(res, result);
    return;
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function handleAdminTemplates(req, res, auth) {
  requireAdmin(auth);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("format_template")
      .select("id, template_name, description, scope, version_no, creator_id, is_default, status, created_at")
      .is("deleted_at", null)
      .order("id", { ascending: true });
    if (error) throw new ApiError(error.message, 500);
    ok(res, { list: data || [] });
    return;
  }

  if (req.method === "POST") {
    const payload = parseJsonBody(req);
    const name = payload.template_name;
    const versionNo = payload.version_no || "v1.0.0";
    const insertPayload = {
      template_name: name,
      description: payload.description || null,
      scope: payload.scope || "SYSTEM",
      version_no: versionNo,
      creator_id: auth.userId,
      is_default: 0,
      status: payload.status ?? 1,
      published_at: new Date().toISOString()
    };

    const { error } = await supabase.from("format_template").insert(insertPayload);
    if (error) {
      if (String(error.code || "") !== "23505") throw new ApiError(error.message, 500);
      const { error: reviveError } = await supabase
        .from("format_template")
        .update({
          description: payload.description || null,
          scope: payload.scope || "SYSTEM",
          status: payload.status ?? 1,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("template_name", name)
        .eq("version_no", versionNo);
      if (reviveError) throw new ApiError(reviveError.message, 500);
    }
    ok(res, {});
    return;
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function handleAdminTemplateById(req, res, auth, templateId) {
  requireAdmin(auth);
  if (req.method === "PUT") {
    const payload = parseJsonBody(req);
    const updatePayload = {
      template_name: payload.template_name,
      description: payload.description || null,
      scope: payload.scope || "SYSTEM",
      version_no: payload.version_no || "v1.0.0",
      status: payload.status ?? 1,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("format_template").update(updatePayload).eq("id", templateId);
    if (error) throw new ApiError(error.message, 500);
    ok(res, {});
    return;
  }

  if (req.method === "DELETE") {
    const result = await deleteWithFallback("format_template", templateId, {
      deleted_at: new Date().toISOString(),
      status: 0
    });
    ok(res, result);
    return;
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function handleAdminTemplateRules(req, res, auth, templateId) {
  requireAdmin(auth);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("format_rule")
      .select("id, template_id, rule_code, rule_name, rule_type, severity, rule_config, description, order_no, enabled")
      .eq("template_id", templateId)
      .order("order_no", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new ApiError(error.message, 500);
    ok(res, { list: data || [] });
    return;
  }

  if (req.method === "PUT") {
    const payload = parseJsonBody(req);
    const rows = Array.isArray(payload?.rules) ? payload.rules : [];
    if (!rows.length) {
      const { error: clearError } = await supabase.from("format_rule").delete().eq("template_id", templateId);
      if (clearError) throw new ApiError(clearError.message, 500);
      ok(res, {});
      return;
    }

    const upsertRows = rows.map((r, idx) => ({
      template_id: templateId,
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      rule_type: r.rule_type || "CUSTOM",
      severity: r.severity || "ERROR",
      rule_config: r.rule_config || {},
      description: r.description || null,
      order_no: r.order_no ?? (idx + 1) * 10,
      enabled: r.enabled ?? 1
    }));

    const { error: upsertError } = await supabase.from("format_rule").upsert(upsertRows, { onConflict: "template_id,rule_code" });
    if (upsertError) throw new ApiError(upsertError.message, 500);

    const keepCodes = [...new Set(upsertRows.map((row) => row.rule_code))];
    const { data: currentRows, error: currentError } = await supabase
      .from("format_rule")
      .select("id, rule_code")
      .eq("template_id", templateId);
    if (currentError) throw new ApiError(currentError.message, 500);

    const staleIds = (currentRows || []).filter((row) => !keepCodes.includes(row.rule_code)).map((row) => row.id);
    if (staleIds.length) {
      const { error: staleDeleteError } = await supabase.from("format_rule").delete().in("id", staleIds);
      if (staleDeleteError) throw new ApiError(staleDeleteError.message, 500);
    }

    ok(res, {});
    return;
  }

  throw new ApiError("Method Not Allowed", 405);
}

async function handleAdminStats(req, res, auth) {
  requireAdmin(auth);

  const [
    { count: userCount, error: e1 },
    { count: templateCount, error: e2 },
    { count: taskCount, error: e3 },
    { count: paperCount, error: e7 }
  ] = await Promise.all([
    supabase.from("sys_user").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("format_template").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", 1),
    supabase.from("detection_task").select("*", { count: "exact", head: true }),
    supabase.from("paper").select("*", { count: "exact", head: true }).is("deleted_at", null)
  ]);
  if (e1 || e2 || e3 || e7) throw new ApiError(e1?.message || e2?.message || e3?.message || e7?.message, 500);

  const { data: recentTasks, error: e4 } = await supabase
    .from("detection_task")
    .select("id, paper_id, submitter_id, created_at, detection_result(total_score)")
    .order("id", { ascending: false })
    .limit(10);
  if (e4) throw new ApiError(e4.message, 500);

  const submitterIds = [...new Set((recentTasks || []).map((x) => x.submitter_id).filter(Boolean))];
  const userMap = {};
  if (submitterIds.length) {
    const { data: users, error: e5 } = await supabase.from("sys_user").select("id, username").in("id", submitterIds);
    if (e5) throw new ApiError(e5.message, 500);
    (users || []).forEach((u) => {
      userMap[u.id] = u.username;
    });
  }

  const formattedRecent = (recentTasks || []).map((t) => {
    const dr = normalizeDetectionResult(t.detection_result);
    return {
      task_id: t.id,
      paper_id: t.paper_id,
      username: userMap[t.submitter_id] || "-",
      score: Number(dr.total_score || 0),
      created_at: t.created_at
    };
  });

  const { data: passRows, error: e6 } = await supabase.from("detection_result").select("pass_flag");
  if (e6) throw new ApiError(e6.message, 500);
  const total = passRows?.length || 0;
  const pass = (passRows || []).filter((x) => Number(x.pass_flag) === 1).length;
  const passRate = total ? Number(((pass / total) * 100).toFixed(1)) : 0;

  ok(res, {
    user_count: userCount || 0,
    paper_count: paperCount || 0,
    template_count: templateCount || 0,
    task_count: taskCount || 0,
    pass_rate: passRate,
    recent_tasks: formattedRecent
  });
}

export default async function handler(req, res) {
  try {
    ensureSupabaseEnv();

    const rawUrl = String(req.url || "");
    const pathname = rawUrl.split("?")[0] || "/";
    let path = pathname.startsWith("/api/") ? pathname.slice(4) : pathname === "/api" ? "/" : pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const method = String(req.method || "GET").toUpperCase();
    let auth = getAuth(req);
    auth = await hydrateAuth(auth);

    if (method === "GET" && path === "/health") {
      ok(res, {
        status: "ok",
        supabase_url_set: Boolean(supabaseUrl),
        service_role_set: Boolean(supabaseServiceRoleKey)
      });
      return;
    }

    if (method === "POST" && (path === "/auth/login" || path === "/session/login")) return handleAuthLogin(req, res);
    if (method === "POST" && (path === "/auth/register" || path === "/session/register")) return handleAuthRegister(req, res);
    if (method === "POST" && (path === "/auth/forgot-password" || path === "/session/forgot-password")) return handleAuthForgot(req, res);

    if (method === "POST" && path === "/user/upload") return handleUserUpload(req, res, auth);
    if (method === "POST" && path === "/user/detect") return handleUserDetect(req, res, auth);
    if (method === "POST" && path === "/user/auto-format") return handleUserAutoFormat(req, res, auth);
    if (method === "GET" && path === "/user/history") return handleUserHistory(req, res, auth);
    if (method === "GET" && path === "/user/stats") return handleUserStats(req, res, auth);
    if (method === "GET" && path === "/user/templates") return handleUserTemplates(req, res);
    if (method === "GET" && path === "/user/report") return handleUserReport(req, res);

    const fileDownloadMatch = path.match(/^\/files\/(\d+)\/download$/);
    if (method === "GET" && fileDownloadMatch) return handleFileDownload(req, res, Number(fileDownloadMatch[1]));

    const fileDeleteMatch = path.match(/^\/files\/(\d+)$/);
    if (method === "DELETE" && fileDeleteMatch) return handleFileDelete(req, res, auth, Number(fileDeleteMatch[1]));

    const reportExcelMatch = path.match(/^\/reports\/(\d+)\/excel$/);
    if (method === "GET" && reportExcelMatch) return handleReportExcel(req, res, Number(reportExcelMatch[1]));

    if (path === "/admin/users") return handleAdminUsers(req, res, auth);

    const adminUserMatch = path.match(/^\/admin\/users\/(\d+)$/);
    if (adminUserMatch) return handleAdminUserById(req, res, auth, Number(adminUserMatch[1]));

    if (path === "/admin/templates") return handleAdminTemplates(req, res, auth);

    const adminTemplateRuleMatch = path.match(/^\/admin\/templates\/(\d+)\/rules$/);
    if (adminTemplateRuleMatch) return handleAdminTemplateRules(req, res, auth, Number(adminTemplateRuleMatch[1]));

    const adminTemplateMatch = path.match(/^\/admin\/templates\/(\d+)$/);
    if (adminTemplateMatch) return handleAdminTemplateById(req, res, auth, Number(adminTemplateMatch[1]));

    if (method === "GET" && path === "/admin/stats") return handleAdminStats(req, res, auth);

    throw new ApiError("API route not found", 404);
  } catch (error) {
    fail(res, error);
  }
}


