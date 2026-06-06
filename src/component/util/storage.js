export const setLocalStorage = (key, value) => {
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const getLocalStorage = (key) => {
  if (!key) return null;
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};
