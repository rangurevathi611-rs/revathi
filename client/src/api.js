const API = '/api';

let accessToken = null;
let refreshing = null;
let onAuthFailure = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

async function parse(res) {
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 180) };
    }
  }
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = new Error('Sign in required');
          error.status = 401;
          throw error;
        }
        const data = await res.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function skipRefresh(path) {
  return path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/refresh');
}

export async function api(path, { method = 'GET', body, form, retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
  });

  if (res.status === 401 && retry && !skipRefresh(path)) {
    try {
      await refreshSession();
    } catch (err) {
      accessToken = null;
      onAuthFailure();
      throw err;
    }
    return api(path, { method, body, form, retry: false });
  }

  return parse(res);
}

export async function downloadFile(id, filename) {
  const run = async (retry) => {
    const res = await fetch(`${API}/documents/${id}/file`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
    });
    if (res.status === 401 && retry) {
      try {
        await refreshSession();
      } catch (err) {
        accessToken = null;
        onAuthFailure();
        throw err;
      }
      return run(false);
    }
    if (!res.ok) {
      let message = 'Download failed';
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // The body was not JSON.
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return run(true);
}
