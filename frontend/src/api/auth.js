import { buildApiResponse, supabase, toApiError } from "./supabase";

export function loginApi(payload) {
  return loginBySupabase(payload);
}

export function registerApi(payload) {
  return registerBySupabase(payload);
}

export function forgotPasswordApi(payload) {
  return forgotPasswordBySupabase(payload);
}

async function loginBySupabase(payload) {
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");
  if (!username || !password) throw toApiError("请输入用户名和密码", 400);

  const { data, error } = await supabase
    .from("sys_user")
    .select("id, username, password_hash, role, real_name, email, phone, status")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data || Number(data.status) !== 1) throw toApiError("用户名或密码错误", 401);

  // NOTE: This demo mode follows existing project seed style (plain text).
  // Production should switch to RPC + pgcrypto or Supabase Auth.
  if (String(data.password_hash || "") !== password) throw toApiError("用户名或密码错误", 401);

  const loginAt = new Date().toISOString();
  const [userUpdateResult, logInsertResult] = await Promise.all([
    supabase
      .from("sys_user")
      .update({ last_login_at: loginAt, updated_at: loginAt })
      .eq("id", data.id),
    supabase.from("system_log").insert({
      user_id: data.id,
      log_type: "LOGIN",
      module: "auth",
      action: "login",
      target_type: "user",
      target_id: String(data.id),
      level: "INFO",
      message: "用户登录成功",
      detail_json: {
        username: data.username,
        source: "supabase"
      }
    })
  ]);

  if (userUpdateResult.error) throw toApiError(userUpdateResult.error.message, 500);
  if (logInsertResult.error) throw toApiError(logInsertResult.error.message, 500);

  const accessToken = `sb-local-${data.id}-${Date.now()}`;
  return buildApiResponse({
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

async function registerBySupabase(payload) {
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");
  if (!username || !password) throw toApiError("请填写用户名和密码", 400);

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
    if (/duplicate key|unique/i.test(error.message || "")) {
      throw toApiError("用户名/邮箱/手机号已存在", 409);
    }
    throw toApiError(error.message, 500);
  }
  return buildApiResponse({});
}

async function forgotPasswordBySupabase(payload) {
  const username = String(payload?.username || "").trim();
  const email = String(payload?.email || "").trim();
  const phone = String(payload?.phone || "").trim();
  const newPassword = String(payload?.new_password || "");
  if (!username || !newPassword) throw toApiError("请填写用户名和新密码", 400);
  if (!email && !phone) throw toApiError("邮箱或手机号至少填写一个", 400);

  let query = supabase
    .from("sys_user")
    .select("id, email, phone")
    .eq("username", username)
    .is("deleted_at", null)
    .limit(1);
  if (email) query = query.eq("email", email);
  if (phone) query = query.eq("phone", phone);

  const { data, error } = await query.maybeSingle();
  if (error) throw toApiError(error.message, 500);
  if (!data) throw toApiError("用户名或联系方式不匹配", 404);

  const { error: updateError } = await supabase
    .from("sys_user")
    .update({ password_hash: newPassword, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (updateError) throw toApiError(updateError.message, 500);
  return buildApiResponse({});
}
