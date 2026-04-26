import axios from "axios";

const apiClient = axios.create({
  timeout: 60000
});

function normalizeApiPath(path) {
  let p = String(path || "").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.startsWith("/api/")) p = `/api${p}`;
  return p;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token") || "";
  const userRaw = localStorage.getItem("user_info");

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      config.headers = config.headers || {};
      if (user?.id != null) config.headers["x-user-id"] = String(user.id);
      if (user?.role) config.headers["x-user-role"] = String(user.role);
    } catch {
      // ignore invalid local cache
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (resp) => {
    const payload = resp?.data;
    if (payload && typeof payload === "object" && "code" in payload && Number(payload.code) !== 0) {
      const err = new Error(payload.message || "Request failed");
      err.response = { ...resp, data: payload };
      throw err;
    }
    return resp;
  },
  (error) => {
    if (error?.response?.data?.message && !error.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);

export async function apiPost(path, payload = {}) {
  const resp = await apiClient.post(normalizeApiPath(path), payload);
  return resp.data;
}

export async function apiGet(path, params) {
  const resp = await apiClient.get(normalizeApiPath(path), { params });
  return resp.data;
}

export async function apiPut(path, payload = {}) {
  const resp = await apiClient.put(normalizeApiPath(path), payload);
  return resp.data;
}

export async function apiDelete(path) {
  const resp = await apiClient.delete(normalizeApiPath(path));
  return resp.data;
}

export async function apiGetBlob(path, params) {
  return apiClient.get(normalizeApiPath(path), {
    params,
    responseType: "blob"
  });
}
