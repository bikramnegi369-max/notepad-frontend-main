import { BsFillSendFill } from "react-icons/bs";
import Messageuser from "./User";
import { useEffect, useRef, useState } from "react";
import { Api_Url } from "../api/api";
import useAuth from "../../contexts/Auth";
import { FaFileAlt } from "react-icons/fa";
import { IoIosAttach } from "react-icons/io";
import socket from "../../socket";
import dateFormat from "dateformat";
import { IoClose } from "react-icons/io5";
import { AiOutlineFilePdf } from "react-icons/ai";

export default function Message() {
  const [userNameAlreadySelected, setUsernameAlreadySelected] = useState(false);
  const [userId, setUserId] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formdataValue, setFormdataValue] = useState(false);
  const [message, setMessages] = useState("");
  const [userChats, setUserChats] = useState([]);
  const [users, setUsers] = useState([]);
  const { cookies } = useAuth();
  const chatContainerRef = useRef(null);
  const [filePath,setFilePath]=useState(null);
  const [filePreview,setFilePreview]=useState();
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    console.log(file);
    setFilePath(file.name);
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    setFormdataValue(true);
  };

  const handleClick = (pdfUrl) => {
    window.open(`https://https://4frnn03l-3000.inc1.devtunnels.ms/public/attachments/${pdfUrl}`, "_blank");
  };

  const handleMessage = (e) => {
    setMessages(e.target.value);
  };

  const handleSubmitMessage = async () => {
    console.log("sending message");
    socket.emit("private message", { message,selectedFile,filePath, to: userId.sender });
    setMessages("");
    setFilePreview(null);
    setSelectedFile(null);
  };

  const handleId = (id) => {
    setUserId({ sender: id });
    setFilePreview(null);
    setSelectedFile(null)
    const to = id;
    console.log(id, "id ");
    socket.emit("messages", to);
  };

  const onMessages = () => {
    socket.on("messages", (data) => {
      console.log(data, "data");
      setUserChats(data);
    });
  };
  
useEffect(() => {
  localStorage.removeItem("sessionID");
  console.log("socket connection");
  socket.on("messages", (data) => {
    console.log(data, "data");
    setUserChats(data);
  });

  socket.on("private message", (data) => {
    console.log(data, "new message received");

    setUserChats((prevChats) => [...prevChats, data]);
  });
  const sessionID = localStorage.getItem("sessionID");

  const username = cookies.name;
  const userId = cookies.userId;
  console.log(sessionID);

  if (sessionID) {
    console.log(sessionID, "sesionid");
    setUsernameAlreadySelected(true);
    socket.auth = { sessionID };
    socket.connect();
    // console.log("socket connection")
  } else {
    socket.auth = { username, userId };
    socket.connect();
  }

  socket.on("session", ({ sessionID, userID }) => {
    socket.auth = { sessionID };
    console.log(sessionID,"session")
    localStorage.setItem("sessionID", sessionID);
    socket.userID = userID;
  });

  socket.on("connect_error", (err) => {
    if (err.message === "invalid username") {
      setUsernameAlreadySelected(false);
    }
  });
  socket.on("users", (users) => {
    console.log(users, "socket users");
    setUsers(users);
    //  users.forEach((user) => {

    //     setUsers((existingUsers) => {
    //       const userExists = existingUsers.some(
    //         (existingUser) => existingUser.userID === user.userID
    //       );
    //       if (userExists) {
    //         return existingUsers.map((existingUser) =>
    //           existingUser.userID === user.userID
    //             ? { ...existingUser, ...user }
    //             : existingUser
    //         );
    //       }
    //       user.self = user.userID === socket.userID;
    //       return [...existingUsers, user];
    //     });
    //   });
  });

  return () => {
    socket.off("connect_error");
    socket.disconnect();
    localStorage.removeItem("sessionID");
  };
}, []);



  // Function to group messages by date
  const groupMessagesByDate = (messages) => {
    return messages.reduce((acc, message) => {
      const date = dateFormat(message.timestamp, "d mmmm yyyy");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(message);
      return acc;
    }, {});
  };

  const groupedMessages = groupMessagesByDate(userChats);

  // Scroll to bottom whenever userChats changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [userChats]);

  // Handle "Enter" key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitMessage();
    }
  };

  return (
    <div className="fixed left-0 h-screen w-full">
      <div className="flex gap-5 w-[80%] h-full mx-auto bg-slate-100 p-2">
        <div className="lg:w-[35%] xl:w-[25%] bg-white h-full">
          <Messageuser handleId={handleId} userId={userId.sender} users={users} />
        </div>
        
        {userId && (
          <div className="relative w-full bg-white">
            
            {userChats?.length > 0 && (
              <div ref={chatContainerRef} className="overflow-auto flex flex-col h-[80%] px-4 py-2 w-full">
                {Object.keys(groupedMessages).map((date, index) => (
                  <div key={index}>
                    <div className="rounded-md mb-2 mx-auto bg-gray-300 py-1 px-2 max-w-max">
                      {date}
                    </div>
                    {groupedMessages[date].map((chat) => (
                      <div className={`flex ${chat.sender !== userId.sender
                        ? "justify-end"
                        : "justify-start"}`}>
                        <div
                          key={chat._id}
                          className={`w-[30%] break-all mb-4 text-white flex flex-col justify-center px-4 rounded-tl-xl rounded-br-xl p-2 relative ${
                            chat.sender === userId.sender
                              ? " bg-[#2F0326]"
                              : " bg-[#170625d1]"
                          }`}
                        >
                          {chat.attachment ? (
                            <div className="w-full bg-[#170625d1] rounded-xl p-2 flex justify-center">
                              <button
                                className="flex gap-2 justify-center items-end"
                                onClick={() => handleClick(chat.attachment)}
                              >
                                Open File <FaFileAlt size={20} />
                              </button>
                            </div>
                          ) : null}
                          <p className="flex justify-between items-center ">
                            {chat.message}
                          </p>
                          <p className="text-[12px] self-end mt-2">
                            {dateFormat(chat.timestamp, "h:MM TT")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {userChats.length === 0 && (
              <div className="flex flex-col h-[80%] items-center justify-center w-full z-50">
                <img
                  src="image/noChat.png"
                  alt="No Chat"
                  className="ms-4 w-[30%] h-[200px]"
                />
              </div>
            )}

{filePreview && (
              <div className="w-full absolute px-5 py-4 -top-2  h-[78%] bg-gray-200 z-10 mt-2">
                <button
                  className="font-bold text-lg"
                  onClick={() => {
                    setFilePreview(null);
                    setSelectedFile(null);
                 
                  }}
                >
                  <IoClose className=""  size={30}/>
                </button>
                <div className="flex h-full justify-center items-center">
                  {selectedFile.type === "image" ? (
                      <div className="flex flex-col gap-y-10 items-center">
                      <p>{selectedFile.name}</p>
                    <img src={filePreview} alt="Preview" className="h-40" /></div>
                  ) :  selectedFile.type === "application/pdf" ? (
                    <div className="flex flex-col gap-y-10 items-center">
                      <p>{selectedFile.name}</p>
                      <AiOutlineFilePdf size={80} />
                      
                    </div>
                  ) : (
                    <div className="flex flex-col gap-y-10 items-center">
                      <p>{selectedFile.name}</p>
                      <FaFileAlt size={80} />
                      
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="bg-gray-200 sticky py-2 bottom-0 w-full border-b border-solid border-gray-50">
              <div className="w-[75%] mx-auto flex justify-center items-center gap-4 relative">
                <span className="absolute top-3 bottom-0 left-2 w-auto">
                  <label htmlFor="file-upload">
                    <IoIosAttach size={24} />
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    name="attachment"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </span>

                <input
                  type="text"
                  placeholder="Type Message..."
                  className="border w-full pl-10 pr-20 py-3 rounded-lg"
                  name="message"
                  value={message}
                  onChange={handleMessage}
                  onKeyDown={handleKeyDown}
                />

                <div className="absolute bottom-1 right-2">
                  {message || formdataValue ? (
                    <button
                      className="bg-black px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10"
                      onClick={handleSubmitMessage}
                    >
                      Send
                      <BsFillSendFill />
                    </button>
                  ) : (
                    <button
                      className="bg-gray-300 px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10 cursor-not-allowed"
                      onClick={handleSubmitMessage}
                      disabled
                    >
                      Send
                      <BsFillSendFill />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!userId && (
          <div className="bg-[#aeabb11f] w-full flex justify-center items-center">
            <img
              src="image/chatimage.png"
              alt="Chat"
              className="ms-4 w-[70%] h-[600px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}















// import { BsFillSendFill } from "react-icons/bs";
// import Messageuser from "./User";
// import { useEffect, useState } from "react";
// import { Api_Url } from "../api/api";
// import useAuth from "../../contexts/Auth";
// import { FaFileAlt } from "react-icons/fa";
// import { IoIosAttach } from "react-icons/io";
// import socket from "../../socket";
// import dateFormat from "dateformat";

// export default function Message() {
//   const [userNameAlreadySelected, setUsernameAlreadySelected] = useState(false);
//   const [userId, setUserId] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [formdataValue, setFormdataValue] = useState(false);
//   const [message, setMessages] = useState("");
//   const [userChats, setUserChats] = useState([]);
//   const [users, setUsers] = useState([]);
//   const { cookies } = useAuth();

//   const handleFileChange = (event) => {
//     const file = event.target.files[0];
//     setSelectedFile(file);
//     setFormdataValue(true);
//   };

//   const handleClick = (pdfUrl) => {
//     window.open(pdfUrl, "_blank");
//   };

//   const handleMessage = (e) => {
//     setMessages(e.target.value);
//   };

//   const handleSubmitMessage = async () => {
//     console.log("sending message");
//     socket.emit("private message", { message, to: userId.sender });
//     setMessages("");
//   };

//   const handleId = (id) => {
//     setUserId({ sender: id });
//     const to = id;
//     console.log(id, "id ");
//     socket.emit("messages", to);
//   };

//   const onMessages = () => {
//     socket.on("messages", (data) => {
//       console.log(data, "data");
//       setUserChats(data);
//     });
//   };

//   useEffect(() => {
//     onMessages();

//     socket.on("private message", (data) => {
//       console.log(data, "new message received");
//       setUserChats((prevChats) => [...prevChats, data]);
//     });
//   }, [setUserChats]);

//   useEffect(() => {
//     const sessionID = localStorage.getItem("sessionID");

//     const username = cookies.name;
//     const userId = cookies.userId;
//     console.log(sessionID);

//     if (sessionID) {
//       console.log(sessionID, "sessionID");
//       setUsernameAlreadySelected(true);
//       socket.auth = { sessionID };
//       socket.connect();
//     } else {
//       socket.auth = { username, userId };
//       socket.connect();
//     }

//     socket.on("session", ({ sessionID, userID }) => {
//       socket.auth = { sessionID };
//       localStorage.setItem("sessionID", sessionID);
//       socket.userID = userID;
//     });

//     socket.on("connect_error", (err) => {
//       if (err.message === "invalid username") {
//         setUsernameAlreadySelected(false);
//       }
//     });

//     socket.on("users", (users) => {
//       console.log(users, "socket users");
//       setUsers(users);
//     });

//     return () => {
//       socket.off("connect_error");
//     };
//   }, []);

//   // Function to group messages by date
//   const groupMessagesByDate = (messages) => {
//     return messages.reduce((acc, message) => {
//       const date = dateFormat(message.timestamp, "d mmmm yyyy");
//       if (!acc[date]) {
//         acc[date] = [];
//       }
//       acc[date].push(message);
//       return acc;
//     }, {});
//   };

//   const groupedMessages = groupMessagesByDate(userChats);
//    // Handle "Enter" key press
//    const handleKeyDown = (e) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       handleSubmitMessage();
//     }
//   };

//   return (
//     <div className="fixed left-0 h-screen w-full">
//       <div className="flex gap-5 w-[80%] h-full mx-auto bg-slate-100 p-2">
//         <div className="w-[25%] bg-white h-full">
//           <Messageuser handleId={handleId} userId={userId.sender} users={users} />
//         </div>

//         {userId && (
//           <div className="w-full bg-white">
//             {userChats?.length > 0 && (
//               <div className="overflow-auto flex flex-col h-[80%] px-4 py-2 w-full">
//                 {Object.keys(groupedMessages).map((date, index) => (
//                   <div key={index}>
//                     <div className="rounded-md mb-2 mx-auto bg-gray-300 py-1 px-2 max-w-max">
//                       {date}
//                     </div>
//                     {groupedMessages[date].map((chat) => (
//                       <div className={`flex ${chat.sender !== userId.sender
//                         ? "justify-end"
//                         : "justify-start"}`}>
//                       <div
//                         key={chat._id}
//                         className={`w-[30%] break-all mb-4 text-white flex flex-col justify-center px-4 rounded-tl-xl rounded-br-xl p-2 relative ${
//                           chat.sender === userId.sender
//                             ? " bg-[#2F0326]"
//                             : " bg-[#170625d1]"
//                         }`}
//                       >
//                         {chat.attachment ? (
//                           <div className="w-full bg-[#170625d1] rounded-xl p-2 flex justify-center">
//                             <button
//                               className="flex gap-2 justify-center items-end"
//                               onClick={() => handleClick(chat.attachment)}
//                             >
//                               Open File <FaFileAlt size={20} />
//                             </button>
//                           </div>
//                         ) : null}
//                         <p className="flex justify-between items-center">
//                           {chat.message}
//                         </p>
//                         <p className="text-[12px] self-end -mt-3">
//                           {dateFormat(chat.timestamp, "h:MM TT")}
//                         </p>
//                       </div>
//                       </div>
//                     ))}
//                   </div>
//                 ))}
//               </div>
//             )}
//             {userChats.length === 0 && (
//               <div className="flex flex-col h-[80%] items-center justify-center w-full z-50">
//                 <img
//                   src="image/noChat.png"
//                   alt="No Chat"
//                   className="ms-4 w-[30%] h-[200px]"
//                 />
//               </div>
//             )}
//             <div className="bg-gray-200 sticky py-2 bottom-0 w-full border-b border-solid border-gray-50">
//               <div className="w-[75%] mx-auto flex justify-center items-center gap-4 relative">
//                 <span className="absolute top-3 bottom-0 left-2 w-auto">
//                   <label htmlFor="file-upload">
//                     <IoIosAttach size={24} />
//                   </label>
//                   <input
//                     id="file-upload"
//                     type="file"
//                     name="attachment"
//                     style={{ display: "none" }}
//                     onChange={handleFileChange}
//                   />
//                 </span>

//                 <input
//                   type="text"
//                   placeholder="Type Message..."
//                   className="border w-full pl-10 pr-20 py-3 rounded-lg"
//                   name="message"
//                   value={message}
//                   onChange={handleMessage}
//                   onKeyDown={handleKeyDown} // Add the keydown event listener
//                 />

//                 <div className="absolute bottom-1 right-2">
//                   {message || formdataValue ? (
//                     <button
//                       className="bg-black px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10"
//                       onClick={handleSubmitMessage}
//                     >
//                       Send
//                       <BsFillSendFill />
//                     </button>
//                   ) : (
//                     <button
//                       className="bg-gray-300 px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10 cursor-not-allowed"
//                       onClick={handleSubmitMessage}
//                       disabled
//                     >
//                       Send
//                       <BsFillSendFill />
//                     </button>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {!userId && (
//           <div className="bg-[#aeabb11f] w-full flex justify-center items-center">
//             <img
//               src="image/chatimage.png"
//               alt="Chat"
//               className="ms-4 w-[70%] h-[600px]"
//             />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



















// import { BsFillSendFill } from "react-icons/bs";
// import Messageuser from "./User";
// import { useEffect, useRef, useState } from "react";
// import { Api_Url } from "../api/api";
// import useAuth from "../../contexts/Auth";
// import { FaCloudUploadAlt, FaFileAlt } from "react-icons/fa";
// import { IoIosAttach } from "react-icons/io";
// import socket from "../../socket";
// import dateFormat from "dateformat";

// export default function Message() {
//   const [userNameAlreadySelected, setUsernameAlreadySelected] = useState(false);
//   const [userId, setuserId] = useState(false);

//   const [selectedFile, setSelectedFile] = useState(null);
//   const [formdataValue, setFormdataValue] = useState(false);

//   const handleFileChange = (event) => {
//     const file = event.target.files[0];
//     setSelectedFile(file);
//     setFormdataValue(true);
//   };

//   const handleClick = (pdfUrl) => {
//     window.open(pdfUrl, "_blank");
//   };

//   const [message, setMessages] = useState("");

//   const [userChats, setUserChats] = useState([]);
//   const [users, setUsers] = useState([]);
//   const { cookies } = useAuth();
//   const handelMessage = (e) => {
//     setMessages(e.target.value);
//   };
//   const handelSubmitMessage = async () => {
//     console.log("sending message");
//     socket.emit("private message", { message, to: userId.sender });
//     setMessages("");
//     // try {
//     //   if (selectedFile) {
//     //     const formData = new FormData();
//     //     formData.append("attachment", selectedFile);
//     //     formData.append("message", messages);
//     //     formData.append("receiver", userId.sender);
//     //     setFormdataValue(formData);
//     //     try {
//     //       const response = await Api_Url.post("message", formData, {
//     //         headers: {
//     //           "Content-Type": "multipart/form-data",
//     //           Authorization: `Bearer ${cookies?.token}`,
//     //         },
//     //       });

//     //       setSelectedFile(null);
//     //       setMessages("");
//     //     } catch (error) {
//     //       console.error("Error uploading file:", error);
//     //     }
//     //   } else {
//     //     const response = await Api_Url.post(
//     //       `message`,
//     //       {
//     //         message: messages,
//     //         receiver: userId.sender,
//     //       },
//     //       {
//     //         headers: {
//     //           "Content-Type": "application/json",
//     //           Authorization: `Bearer ${cookies?.token}`,
//     //         },
//     //       }
//     //     );
//     //     if (response.data.status === "success") {
//     //       // toast.success(response.data.message);
//     //       setMessages("");

//     //     }
//     //   }
//     // } catch (error) {}
//   };

//   const handleId = (id) => {
//     setuserId({ sender: id });
//     const to = id;
//     console.log(id, "id ");
//     socket.emit("messages", to);
//   };

//   const onMessages = () => {
//     socket.on("messages", (data) => {
//       console.log(data, "data");
//       setUserChats(data);
//     });
//   };

//   useEffect(() => {
//     onMessages();

//     socket.on("private message", (data) => {
//       console.log(data, "new message received");
//       setUserChats((prevChats) => [...prevChats, data]);
//     });
//   }, [setUserChats]);

//   useEffect(() => {
//     const sessionID = localStorage.getItem("sessionID");

//     const username = cookies.name;
//     const userId = cookies.userId;
//     console.log(sessionID);

//     if (sessionID) {
//       console.log(sessionID, "sesionid");
//       setUsernameAlreadySelected(true);
//       socket.auth = { sessionID };
//       socket.connect();
//       // console.log("socket connection")
//     } else {
//       socket.auth = { username, userId };
//       socket.connect();
//     }

//     socket.on("session", ({ sessionID, userID }) => {
//       socket.auth = { sessionID };
//       localStorage.setItem("sessionID", sessionID);
//       socket.userID = userID;
//     });

//     socket.on("connect_error", (err) => {
//       if (err.message === "invalid username") {
//         setUsernameAlreadySelected(false);
//       }
//     });
//     socket.on("users", (users) => {
//       console.log(users, "socket users");
//       setUsers(users);
//       //  users.forEach((user) => {

//       //     setUsers((existingUsers) => {
//       //       const userExists = existingUsers.some(
//       //         (existingUser) => existingUser.userID === user.userID
//       //       );
//       //       if (userExists) {
//       //         return existingUsers.map((existingUser) =>
//       //           existingUser.userID === user.userID
//       //             ? { ...existingUser, ...user }
//       //             : existingUser
//       //         );
//       //       }
//       //       user.self = user.userID === socket.userID;
//       //       return [...existingUsers, user];
//       //     });
//       //   });
//     });

//     return () => {
//       socket.off("connect_error");
//     };
//   }, []);

  
//   let lastRenderedDate = null;

//   return (
//     <div className="fixed  left-0 h-screen w-full">
//       <div className="flex gap-5 w-[80%] h-full mx-auto bg-slate-100 p-2   ">
//         <div className="w-[25%]  bg-white h-full">
//           <Messageuser
//             handleId={handleId}
//             userId={userId.sender}
//             users={users}
//           />
//         </div>

//         {userId && (
//           <div className=" w-full bg-white ">
//             {userChats?.length > 0 && (
//               <div className="overflow-auto flex flex-col h-[80%] px-4 py-2  w-full">
//                 {userChats.map((chat, index) => {
//                   const currentDate = dateFormat(chat.timestamp, "d mmmm yyyy");
//                   const showDate = currentDate !== lastRenderedDate;
//                   if (showDate) {
//                     lastRenderedDate = currentDate;
//                   }
//                   return (
//                     <>
//                     {showDate && (
//                         <div className="rounded-md mb-2 fixed z-10 left-[50%] bg-gray-300 py-1 px-2 max-w-max">
//                           {currentDate}
//                         </div>
//                       )}
//                       {/* <div
//                         className={`rounded-md  mb-2 fixed z-10 left-[50%] bg-gray-300  py-1 px-2 max-w-max ${
//                           index !== 0 && "hidden"
//                         }`}
//                       >
//                         {dateFormat(chat.timestamp, "d mmmm yyyy")}
//                       </div>
//                       {messageDate=chat.timestamp} */}
//                       <div
//                         key={chat?._id}
//                         className={`${
//                           chat.sender === userId.sender
//                             ? "self-start bg-[#2F0326]"
//                             : "self-end bg-[#170625d1]"
//                         } w-[30%] break-all mb-4  text-white flex flex-col justify-center px-4 rounded-tl-xl   rounded-br-xl  p-2   relative`}
//                       >
//                         {chat.attachment ? (
//                           <div className="w-full bg-[#170625d1] rounded-xl p-2 flex justify-center ">
//                             <button
//                               className="flex gap-2 justify-center items-end"
//                               onClick={() => handleClick(chat.attachment)}
//                             >
//                               Open File <FaFileAlt size={20} />
//                             </button>
//                           </div>
//                         ) : null}
//                         {/* <div className="w-full bg-[#170625d1] rounded-xl p-2 flex justify-center ">
//                     <button className="flex gap-2 justify-center items-end" onClick={() => handleClick(chat.attachment)}>Open File <FaFileAlt size={20} /></button>
//                     </div> */}

//                         {/* <p >{chat.message}</p> */}
//                         <p className="flex justify-between  items-center">
//                           {chat.message}
//                         </p>
//                         <p className="text-[12px] self-end -mt-3">
//                           {dateFormat(chat.timestamp, "h:MM TT")}
//                         </p>

//                         {/* {chat.message} */}
//                       </div>
//                       {/* <p  className={`${
//                         chat.sender === userId.sender
//                           ? "self-start"
//                           : "self-end"} mb-4`}><small>{new Date(chat.timestamp).toLocaleString()}</small></p> */}
//                     </>
//                   );
//                 })}
//               </div>
//             )}
//             {userChats.length === 0 && (
//               <div className="flex flex-col h-[80%] items-center justify-center w-full z-50   ">
//                 <img
//                   src="image/noChat.png"
//                   alt="Notes"
//                   className="ms-4 w-[30%] h-[200px]"
//                 />
//               </div>
//             )}
//             <div className="bg-gray-200 sticky py-2 bottom-0 w-full border-b border-solid border-gray-50">
//               <div className="w-[75%] mx-auto   flex justify-center items-center  gap-4  relative">
//                 <span className="absolute top-3 bottom-0 left-2 w-auto ">
//                   <label htmlFor="file-upload">
//                     <IoIosAttach size={24} />
//                     {/* <span style={{ marginLeft: '8px' }}>{selectedFile ? selectedFile.name : 'Choose file'}</span> */}
//                   </label>
//                   <input
//                     id="file-upload"
//                     type="file"
//                     // accept="application/pdf"
//                     name="attachment"
//                     style={{ display: "none" }}
//                     onChange={handleFileChange}
//                   />
//                   {/* <button onClick={handleFileUpload} className="z-10">Upload</button> */}
//                 </span>

//                 <input
//                   type="text"
//                   placeholder="Type Message..."
//                   className="border w-full pl-10 pr-20 py-3 rounded-lg"
//                   name="message"
//                   value={message}
//                   onChange={handelMessage}
//                 />

//                 <div className="absolute  bottom-1 right-2 ">
//                   {message || formdataValue ? (
//                     <button
//                       className="bg-black px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10"
//                       onClick={handelSubmitMessage}
//                     >
//                       Send
//                       <BsFillSendFill />
//                     </button>
//                   ) : (
//                     <button
//                       className="bg-gray-300 px-5 py-1 flex gap-2 items-center text-white rounded-lg h-10 cursor-not-allowed"
//                       onClick={handelSubmitMessage}
//                       disabled
//                     >
//                       Send
//                       <BsFillSendFill />
//                     </button>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {!userId && (
//           <div className="bg-[#aeabb11f] w-full flex justify-center items-center">
//             <img
//               src="image/chatimage.png"
//               alt="Notes"
//               className="ms-4 w-[70%] h-[600px]"
//             />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
