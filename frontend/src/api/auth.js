import { apiPost } from "./request";

export function loginApi(payload) {
  return apiPost("/auth/login", payload);
}

export function registerApi(payload) {
  return apiPost("/auth/register", payload);
}

export function forgotPasswordApi(payload) {
  return apiPost("/auth/forgot-password", payload);
}
