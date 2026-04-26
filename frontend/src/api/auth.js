import { apiPost } from "./request";

export function loginApi(payload) {
  return apiPost("/session/login", payload);
}

export function registerApi(payload) {
  return apiPost("/session/register", payload);
}

export function forgotPasswordApi(payload) {
  return apiPost("/session/forgot-password", payload);
}
