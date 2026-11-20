export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function headers(extra?: Record<string, string>) {
  const role = localStorage.getItem("tp_role") || "staff";
  const actor = localStorage.getItem("tp_actor") || "Guest";
  return {
    "Content-Type": "application/json",
    "X-App-Role": role,
    "X-App-Actor": actor,
    ...extra,
  };
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : res.statusText;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => fetch(path, { headers: headers() }).then(handle<T>),
  post: <T>(path: string, body: unknown) =>
    fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) }).then(
      handle<T>,
    ),
  patch: <T>(path: string, body: unknown) =>
    fetch(path, { method: "PATCH", headers: headers(), body: JSON.stringify(body) }).then(
      handle<T>,
    ),
};
