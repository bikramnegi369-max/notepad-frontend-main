import { useEffect, useState } from "react";
import { PiEye } from "react-icons/pi";
import dateFormat from 'dateformat';
import { RxCross2 } from "react-icons/rx";
import { Api_Url } from "../api/api";
import { getLocalStorage } from "../util/storage";
import useAuth from "../../contexts/Auth";

export default function ViewNotes ({id}) {
  const [isOpen, setOpen] = useState(false);
  const [data, setData] = useState([]);
  const {cookies} = useAuth()
 const handleId = async (id) => {
    try {
      const response  = await Api_Url.get(`viewnote/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cookies?.token}`
        }
      })
      setData(response.data.data)
    } catch (error) {
      
    }
  }

  useEffect(() => {
    handleId(id)
  }, [id])
    return (
        <>
        <button onClick={() => setOpen(true)} className="mt-2">
         <PiEye className="text-green-700" size={20}/>
         </button>

         <div>
        {isOpen && (
          <div
            className="fixed inset-0 bg-[#30353eb0] bg-opacity-75 transition-opacity"
            onClick={() => setOpen(false)}
          ></div>
        )}

{isOpen && (
          <div className="absolute inset-0 z-10  overflow-y-auto  ">
            <div className="flex min-h-full   items-center justify-center p-4 text-center sm:items-center sm:p-0 ">
              <div
                className="  overflow-hidden rounded-lg  text-center transition-all w-[60%] sm:my-8 sm:w-full "
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-[60%] h-[600px] overflow-auto ml-auto bg-[#ebedf0]  px-4 pt-5 pb-4 sm:p-6 sm:pb-4 rounded-2xl mx-auto ">
                  <div className="sm:flex sm:items-start w-[90%]">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-[100%]">
                      

                      <h3
                        className="text-lg font-medium leading-6 text-black"
                        id="modal-title"
                      >
                        View Note
                      </h3>
                     
                      
                    
                      <div className="mt-2">
                        <p className="text-black text-[24px]">Create Date : {dateFormat(data?.createdAt, "yyyy/mm/dd")}</p>
                      </div>
                      <div className="flex justify-center mt-4 me-4 ">
                        <textarea className="text-black text-[18px] w-[100%] h-[450px] border-none outline-none p-3 bg-slate-50 overflow-auto" disabled value={data?.content}> </textarea>
                      </div>
                    </div>
                  
                  </div>
                  
                </div>
               
              </div>
              <div className="text-white relative -top-[300px] bottom-0 -left-[320px] right-0">
                        <RxCross2 size={30} className="text-white bg-black rounded-full" onClick={() => setOpen(false)}/>
                        </div>
            </div>
            
          </div>
        )}
      </div>

        </>
    )
}