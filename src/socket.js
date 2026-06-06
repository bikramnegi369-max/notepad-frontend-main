import { io } from "socket.io-client";

// const URL = "https://ns8qgl50-4444.inc1.devtunnels.ms";
const URL = "https://4frnn03l-3000.inc1.devtunnels.ms";
const socket = io(URL, { autoConnect: false });

// https://notepad-backend-f10dee9eba58.herokuapp.com
socket.onAny((event, ...args) => {
  console.log(event, args);
});

export default socket;