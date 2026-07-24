/**
 * Minimal JSON API client. Every mutating request carries the CSRF token
 * embedded in the page's <meta name="csrf-token"> tag.
 */
"use strict";

const Api = (() => {
  const csrfToken = document
    .querySelector('meta[name="csrf-token"]')
    .getAttribute("content");

  async function request(method, path, body) {
    const options = {
      method,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    };
    if (method !== "GET") {
      options.headers["X-CSRF-Token"] = csrfToken;
    }
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);

    if (response.status === 401) {
      // Session expired — send the user back to the login page.
      window.location.href = "/auth/login";
      throw new Error("Session expired");
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      /* non-JSON error body */
    }

    if (!response.ok) {
      const message = (data && data.error) || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  }

  return {
    listCounters: () => request("GET", "/api/counters"),
    createCounter: (payload) => request("POST", "/api/counters", payload),
    updateCounter: (id, payload) => request("PATCH", `/api/counters/${id}`, payload),
    deleteCounter: (id) => request("DELETE", `/api/counters/${id}`),
    increment: (id, delta) =>
      request("POST", `/api/counters/${id}/increment`, delta === undefined ? {} : { delta }),
    reset: (id) => request("POST", `/api/counters/${id}/reset`),
    history: (id) => request("GET", `/api/counters/${id}/history`),
    overview: () => request("GET", "/api/stats/overview"),
  };
})();
