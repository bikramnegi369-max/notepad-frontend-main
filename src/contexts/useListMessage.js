import { useEffect, useState } from "react"
import { userSocketContext } from "./SocketContext"

 const useListMessage = () => {
    const {socket} = userSocketContext()
    const [messageList, setMessageList] = useState([])
    
    useEffect(() => {
        if(socket){
            socket.on("messageList",(data)=>{
                setMessageList(data)
            })
        }
    }, [socket,messageList,setMessageList])
}

export default useListMessage