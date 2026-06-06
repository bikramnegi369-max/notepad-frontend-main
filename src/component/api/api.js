import axios from "axios";

const BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://4frnn03l-3000.inc1.devtunnels.ms/api";
export const API_BASE_URL = BASE_URL;

export const Api_Url = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
  },
});

export function getApiRootUrl() {
  return API_BASE_URL.replace(/\/api\/?$/, "");
}

// Central helper to set/remove auth header from the axios instance
export function setAuthToken(token) {
  if (token) {
    Api_Url.defaults.headers.common["Authorization"] = token.startsWith(
      "Bearer ",
    )
      ? token
      : `Bearer ${token}`;
  } else {
    delete Api_Url.defaults.headers.common["Authorization"];
  }
}

function getTokenFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

Api_Url.interceptors.request.use((config) => {
  const hasAuthHeader =
    config.headers?.Authorization || config.headers?.authorization;
  if (!hasAuthHeader) {
    const token =
      Api_Url.defaults.headers.common["Authorization"] || getTokenFromCookie();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
  }
  return config;
});

// Basic response interceptor (normalize / forward errors)
Api_Url.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      // clear auth header and force user to login
      setAuthToken(null);
      try {
        // best-effort redirect
        window.location.href = "/login";
      } catch (e) {}
    }
    return Promise.reject(error);
  },
);

export default Api_Url;
