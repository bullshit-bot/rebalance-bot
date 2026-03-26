// HTTP client for backend REST API
const BASE_URL = process.env.BACKEND_API_URL ?? "http://backend:3001";

type JsonBody = Record<string, unknown>;

async function request<T>(
  method: string,
  path: string,
  body?: JsonBody
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: JsonBody) =>
    request<T>("POST", path, body),
  put: <T = unknown>(path: string, body?: JsonBody) =>
    request<T>("PUT", path, body),
  delete: <T = unknown>(path: string) => request<T>("DELETE", path),
};
