import { buildApiResponse, supabase, toApiError } from "./supabase";

export function getUsersApi(params = {}) {
  return getUsersBySupabase(params);
}

export function createUserApi(payload) {
  return createUserBySupabase(payload);
}

export function updateUserApi(userId, payload) {
  return updateUserBySupabase(userId, payload);
}

export function deleteUserApi(userId) {
  return deleteUserBySupabase(userId);
}

export function getTemplatesApi() {
  return getTemplatesBySupabase();
}

export function createTemplateApi(payload) {
  return createTemplateBySupabase(payload);
}

export function updateTemplateApi(id, payload) {
  return updateTemplateBySupabase(id, payload);
}

export function deleteTemplateApi(id) {
  return deleteTemplateBySupabase(id);
}

export function getTemplateRulesApi(id) {
  return getTemplateRulesBySupabase(id);
}

export function saveTemplateRulesApi(id, rules) {
  return saveTemplateRulesBySupabase(id, rules);
}

export function getStatsApi() {
  return getStatsBySupabase();
}

function nowIso() {
  return new Date().toISOString();
}

async function deleteWithFallback({ table, id, softPatch }) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (!error) return { hard_deleted: true };
  if (String(error.code || "") !== "23503") throw toApiError(error.message, 500);

  const now = nowIso();
  const patch = { ...(softPatch || {}), updated_at: now };
  const { error: softError } = await supabase.from(table).update(patch).eq("id", id);
  if (softError) throw toApiError(softError.message, 500);
  return { hard_deleted: false, soft_deleted: true };
}

function getCurrentUserId() {
  const raw = localStorage.getItem("user_info");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.id || null;
  } catch {
    return null;
  }
}

async function getUsersBySupabase(params = {}) {
  const key = String(params?.keyword || "").trim();
  const role = String(params?.role || "").trim();
  let query = supabase
    .from("sys_user")
    .select("id, username, role, real_name, email, phone, status, created_at")
    .is("deleted_at", null)
    .order("id", { ascending: false });
  if (role) query = query.eq("role", role);
  if (key) query = query.or(`username.ilike.%${key}%,real_name.ilike.%${key}%`);
  const { data, error } = await query;
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({ list: data || [] });
}

async function createUserBySupabase(payload) {
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
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({});
}

async function updateUserBySupabase(userId, payload) {
  const updatePayload = {
    role: payload.role,
    real_name: payload.real_name || null,
    email: payload.email || null,
    phone: payload.phone || null,
    status: payload.status ?? 1,
    updated_at: nowIso()
  };
  const { error } = await supabase.from("sys_user").update(updatePayload).eq("id", userId);
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({});
}

async function deleteUserBySupabase(userId) {
  const result = await deleteWithFallback({
    table: "sys_user",
    id: userId,
    softPatch: { deleted_at: nowIso(), status: 0 }
  });
  return buildApiResponse(result);
}

async function getTemplatesBySupabase() {
  const { data, error } = await supabase
    .from("format_template")
    .select("id, template_name, description, scope, version_no, creator_id, is_default, status, created_at")
    .is("deleted_at", null)
    .order("id", { ascending: true });
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({ list: data || [] });
}

async function createTemplateBySupabase(payload) {
  const creatorId = getCurrentUserId();
  const name = payload.template_name;
  const versionNo = payload.version_no || "v1.0.0";
  const insertPayload = {
    template_name: name,
    description: payload.description || null,
    scope: payload.scope || "SYSTEM",
    version_no: versionNo,
    creator_id: creatorId,
    is_default: 0,
    status: payload.status ?? 1,
    published_at: nowIso()
  };
  const { error } = await supabase.from("format_template").insert(insertPayload);
  if (error) {
    if (String(error.code || "") !== "23505") throw toApiError(error.message, 500);
    const now = nowIso();
    const { error: reviveError } = await supabase
      .from("format_template")
      .update({
        description: payload.description || null,
        scope: payload.scope || "SYSTEM",
        status: payload.status ?? 1,
        deleted_at: null,
        updated_at: now
      })
      .eq("template_name", name)
      .eq("version_no", versionNo);
    if (reviveError) throw toApiError(reviveError.message, 500);
  }
  return buildApiResponse({});
}

async function updateTemplateBySupabase(id, payload) {
  const updatePayload = {
    template_name: payload.template_name,
    description: payload.description || null,
    scope: payload.scope || "SYSTEM",
    version_no: payload.version_no || "v1.0.0",
    status: payload.status ?? 1,
    updated_at: nowIso()
  };
  const { error } = await supabase.from("format_template").update(updatePayload).eq("id", id);
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({});
}

async function deleteTemplateBySupabase(id) {
  const result = await deleteWithFallback({
    table: "format_template",
    id,
    softPatch: { deleted_at: nowIso(), status: 0 }
  });
  return buildApiResponse(result);
}

async function getTemplateRulesBySupabase(id) {
  const { data, error } = await supabase
    .from("format_rule")
    .select("id, template_id, rule_code, rule_name, rule_type, severity, rule_config, description, order_no, enabled")
    .eq("template_id", id)
    .order("order_no", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw toApiError(error.message, 500);
  return buildApiResponse({ list: data || [] });
}

async function saveTemplateRulesBySupabase(id, rules) {
  const payload = Array.isArray(rules?.rules) ? rules.rules : Array.isArray(rules) ? rules : [];
  if (!payload.length) {
    const { error: clearError } = await supabase.from("format_rule").delete().eq("template_id", id);
    if (clearError) throw toApiError(clearError.message, 500);
    return buildApiResponse({});
  }

  const upsertRows = payload.map((r, idx) => ({
    template_id: id,
    rule_code: r.rule_code,
    rule_name: r.rule_name,
    rule_type: r.rule_type || "CUSTOM",
    severity: r.severity || "ERROR",
    rule_config: r.rule_config || {},
    description: r.description || null,
    order_no: r.order_no ?? (idx + 1) * 10,
    enabled: r.enabled ?? 1
  }));

  const { error: upsertError } = await supabase
    .from("format_rule")
    .upsert(upsertRows, { onConflict: "template_id,rule_code" });
  if (upsertError) throw toApiError(upsertError.message, 500);

  const keepCodes = [...new Set(upsertRows.map((row) => row.rule_code))];
  const { data: currentRows, error: currentError } = await supabase
    .from("format_rule")
    .select("id, rule_code")
    .eq("template_id", id);
  if (currentError) throw toApiError(currentError.message, 500);

  const staleIds = (currentRows || []).filter((row) => !keepCodes.includes(row.rule_code)).map((row) => row.id);
  if (staleIds.length) {
    const { error: staleDeleteError } = await supabase.from("format_rule").delete().in("id", staleIds);
    if (staleDeleteError) throw toApiError(staleDeleteError.message, 500);
  }

  return buildApiResponse({});
}

async function getStatsBySupabase() {
  const [{ count: userCount, error: e1 }, { count: templateCount, error: e2 }, { count: taskCount, error: e3 }, { count: paperCount, error: e7 }] = await Promise.all([
    supabase.from("sys_user").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("format_template").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", 1),
    supabase.from("detection_task").select("*", { count: "exact", head: true }),
    supabase.from("paper").select("*", { count: "exact", head: true }).is("deleted_at", null)
  ]);
  if (e1 || e2 || e3 || e7) throw toApiError(e1?.message || e2?.message || e3?.message || e7?.message, 500);

  const { data: recentTasks, error: e4 } = await supabase
    .from("detection_task")
    .select("id, paper_id, submitter_id, created_at, detection_result(total_score)")
    .order("id", { ascending: false })
    .limit(10);
  if (e4) throw toApiError(e4.message, 500);

  const submitterIds = [...new Set((recentTasks || []).map((x) => x.submitter_id).filter(Boolean))];
  const userMap = {};
  if (submitterIds.length) {
    const { data: users, error: e5 } = await supabase.from("sys_user").select("id, username").in("id", submitterIds);
    if (e5) throw toApiError(e5.message, 500);
    (users || []).forEach((u) => {
      userMap[u.id] = u.username;
    });
  }

  const formattedRecent = (recentTasks || []).map((t) => {
    const dr = Array.isArray(t.detection_result) ? (t.detection_result[0] || {}) : (t.detection_result || {});
    return {
      task_id: t.id,
      paper_id: t.paper_id,
      username: userMap[t.submitter_id] || "-",
      score: Number(dr.total_score || 0),
      created_at: t.created_at
    };
  });

  const { data: passRows, error: e6 } = await supabase.from("detection_result").select("pass_flag");
  if (e6) throw toApiError(e6.message, 500);
  const total = passRows?.length || 0;
  const pass = (passRows || []).filter((x) => Number(x.pass_flag) === 1).length;
  const passRate = total ? Number(((pass / total) * 100).toFixed(1)) : 0;

  return buildApiResponse({
    user_count: userCount || 0,
    paper_count: paperCount || 0,
    template_count: templateCount || 0,
    task_count: taskCount || 0,
    pass_rate: passRate,
    recent_tasks: formattedRecent
  });
}
