import { apiDelete, apiGet, apiGetBlob, apiPost } from "./request";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function normalizeDetectResponse(data) {
  if (!data) return data;
  return {
    ...data,
    download_url: data.download_url || (data.output_file_id ? `/api/files/${data.output_file_id}/download` : "")
  };
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function uploadPaperApi(formData) {
  const file = formData?.get?.("file");
  const payload = {
    title: String(formData?.get?.("title") || "").trim(),
    abstract_text: String(formData?.get?.("abstract_text") || "").trim(),
    keywords: String(formData?.get?.("keywords") || "").trim(),
    file: file
      ? {
          name: file.name,
          type: file.type,
          size: file.size,
          base64: await fileToBase64(file)
        }
      : null
  };
  return apiPost("/user/upload", payload);
}

export function detectPaperApi(paperId, payload = {}) {
  return apiPost("/user/detect", { paper_id: paperId, ...payload });
}

export function getReportApi(taskId) {
  return apiGet("/user/report", { task_id: taskId });
}

export async function autoFormatApi(paperId, payload = {}) {
  const resp = await apiPost("/user/auto-format", { paper_id: paperId, ...payload });
  if (resp?.data) {
    const normalized = normalizeDetectResponse(resp.data);
    if (normalized.download_url?.startsWith("/api") && API_BASE) {
      normalized.download_url = `${API_BASE}${normalized.download_url}`;
    }
    resp.data = normalized;
  }
  return resp;
}

export function getHistoryApi(params = {}) {
  return apiGet("/user/history", params);
}

export function getUserStatsApi() {
  return apiGet("/user/stats");
}

export function getTemplateOptionsApi() {
  return apiGet("/user/templates");
}

export function downloadFileBlobApi(fileId) {
  return apiGetBlob(`/files/${fileId}/download`);
}

export function downloadReportExcelByTaskApi(taskId) {
  return apiGetBlob(`/reports/${taskId}/excel`);
}

export function deleteFileApi(fileId) {
  return apiDelete(`/files/${fileId}`);
}
