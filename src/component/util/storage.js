export const setLocalStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};
export const getLocalStorage = () => {
    return JSON.parse(localStorage.getItem("token"));
}