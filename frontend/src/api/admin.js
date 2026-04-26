import { apiDelete, apiGet, apiPost, apiPut } from "./request";

export function getUsersApi(params = {}) {
  return apiGet("/admin/users", params);
}

export function createUserApi(payload) {
  return apiPost("/admin/users", payload);
}

export function updateUserApi(userId, payload) {
  return apiPut(`/admin/users/${userId}`, payload);
}

export function deleteUserApi(userId) {
  return apiDelete(`/admin/users/${userId}`);
}

export function getTemplatesApi() {
  return apiGet("/admin/templates");
}

export function createTemplateApi(payload) {
  return apiPost("/admin/templates", payload);
}

export function updateTemplateApi(id, payload) {
  return apiPut(`/admin/templates/${id}`, payload);
}

export function deleteTemplateApi(id) {
  return apiDelete(`/admin/templates/${id}`);
}

export function getTemplateRulesApi(id) {
  return apiGet(`/admin/templates/${id}/rules`);
}

export function saveTemplateRulesApi(id, rules) {
  return apiPut(`/admin/templates/${id}/rules`, Array.isArray(rules) ? { rules } : rules);
}

export function getStatsApi() {
  return apiGet("/admin/stats");
}
