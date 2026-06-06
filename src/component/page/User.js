  import { useEffect, useState } from "react";
  import { Api_Url } from "../api/api";
  import useAuth from "../../contexts/Auth";
  // import { userSocketContext } from "../../contexts/SocketContext";

  export default function Messageuser({handleId,userId,users}) {
    // console.log(users)
    const [username, setuserName] = useState([]);
    const {cookies}=useAuth();
    useEffect(() => {
      // allUserGet();
    }, []);
    return (
      
        <div className="p-2  h-full">
          <h1 className="text-xl font-semibold text-black mb-2">Chats</h1>
        {/* <div className="mt-4 cursor-pointer" onClick={() => handleId(username[0]?._id)}>
              <div className="border-b pb-2 flex gap-4 items-center">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-300">
                  {username[0]?.name?.split("")[0]}
                </div>
                <div>
                  <p>You</p>
                </div>
              </div>
            </div> */}
          {users.map((e, i) => (
            <div className="mt-4 cursor-pointer" key={i} onClick={() => handleId(e?._id)}>
              <div className={` pb-2 flex gap-4 items-center ${userId===e?._id?"bg-[#2F0326] text-white p-2 rounded-lg":"border-b p-2"}`}>
                <div className={`h-8 w-12 rounded-full flex items-center justify-center ${userId===e?._id?"bg-white  text-[#280f23] font-semibold":"bg-[#280f23] text-white"} `}>
                  {e?.name?.split("")[0]}
                </div>
                <div className="flex  items-center justify-between w-full">
                  <p>{e.name===cookies.name?"You":e?.name}</p>
                  {e?.newMessages>0&&<div className=" flex justify-center items-center text-xs bg-[#e1dde1] text-[#280f23] w-6 h-6 rounded-full">
                    {e?.newMessages}
                    {/* {isonline?"Online":"Offline"} */}
                    
                    </div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      
    );
  }

