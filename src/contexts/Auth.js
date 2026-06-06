import { createContext, useContext, useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { setAuthToken } from "../component/api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [cookies, setCookie, removeCookie] = useCookies(["token"]);
  const [auth, setAuth] = useState(Boolean(cookies?.token));

  useEffect(() => {
    const token = cookies?.token;
    if (token) {
      setAuth(true);
      setAuthToken(token);
    } else {
      setAuth(false);
      setAuthToken(null);
    }
  }, [cookies]);

  const login = (token, options) => {
    setCookie("token", token, options || { path: "/" });
    setAuth(true);
    setAuthToken(token);
  };

  const logout = () => {
    removeCookie("token", { path: "/" });
    setAuth(false);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ auth, setAuth, cookies, login, logout, setCookie, removeCookie }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}
