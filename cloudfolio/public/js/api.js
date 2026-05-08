/**
 * CloudFolio API Fetch Wrapper
 */

const API = {
  _getLoginRedirect() {
    const path = window.location.pathname;
    if (path.startsWith('/member')) {
      return '/member/login.html';
    }
    return '/staff/login.html';
  },

  async _request(method, path, data) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (data !== undefined) {
      opts.body = JSON.stringify(data);
    }

    let res;
    try {
      res = await fetch('/api' + path, opts);
    } catch (err) {
      throw new Error('Network error. Please check your connection.');
    }

    if (res.status === 401) {
      window.location.href = API._getLoginRedirect();
      throw new Error('Not authenticated.');
    }

    let body;
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    if (!res.ok) {
      const message = (body && body.error) ? body.error : `Request failed (${res.status})`;
      throw new Error(message);
    }

    return body;
  },

  async get(path) {
    return this._request('GET', path, undefined);
  },

  async post(path, data) {
    return this._request('POST', path, data);
  },

  async put(path, data) {
    return this._request('PUT', path, data);
  },

  async delete(path) {
    return this._request('DELETE', path, undefined);
  }
};
