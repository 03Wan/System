import { apiPost } from "./request";

async function postWithFallback(primaryPath, fallbackPath, payload) {
  try {
    return await apiPost(primaryPath, payload);
  } catch (error) {
    if (Number(error?.response?.status) === 404 && fallbackPath) {
      return apiPost(fallbackPath, payload);
    }
    throw error;
  }
}

export function loginApi(payload) {
  return postWithFallback("/session/login", "/auth/login", payload);
}

export function registerApi(payload) {
  return postWithFallback("/session/register", "/auth/register", payload);
}

export function forgotPasswordApi(payload) {
  return postWithFallback("/session/forgot-password", "/auth/forgot-password", payload);
}
