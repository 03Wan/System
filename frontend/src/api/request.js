import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 60000
});

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
  (resp) => resp,
  (error) => {
    if (error?.response?.data?.message && !error.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);

export async function apiPost(path, payload = {}) {
  const resp = await apiClient.post(path, payload);
  return resp.data;
}

export async function apiGet(path, params) {
  const resp = await apiClient.get(path, { params });
  return resp.data;
}

export async function apiPut(path, payload = {}) {
  const resp = await apiClient.put(path, payload);
  return resp.data;
}

export async function apiDelete(path) {
  const resp = await apiClient.delete(path);
  return resp.data;
}

export async function apiGetBlob(path, params) {
  return apiClient.get(path, {
    params,
    responseType: "blob"
  });
}
