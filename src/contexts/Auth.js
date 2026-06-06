import { createContext, useContext,  useEffect,  useState } from "react";
import { getLocalStorage } from "../component/util/storage";
import { useCookies } from "react-cookie";

const AuthContext=createContext();

export const AuthProvider=({children})=>{
    const [cookies, setCookie,removeCookie] = useCookies(['token']);
    const [auth,setAuth]=useState(cookies?.token?true:false)
    
   
    useEffect(() => {
        if (cookies?.token) {
            setAuth(true);
        }
        else
        setAuth(false)
    }, [cookies]);
    return(
        <AuthContext.Provider value={{auth,setAuth,cookies,setCookie,removeCookie}}>
            {children}
        </AuthContext.Provider>
    )
}


export default function useAuth(){
    return useContext(AuthContext)
}