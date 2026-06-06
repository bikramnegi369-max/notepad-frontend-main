import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAuth from "../../contexts/Auth";
import { Api_Url } from "../api/api";

export default function UpdateNote() {
    
    const [updateNotedata, setUpdateNotedata] = useState({});
    const navigate = useNavigate();
    const { id } = useParams();
    console.log(id)
    const { cookies } = useAuth();
    const handleSingleNote = async () => {
        try {
            const response = await Api_Url.get(`viewnote/${id}`, {  
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cookies?.token}`
                }
            });
            setUpdateNotedata(response.data.data);
        } catch (error) {
            toast.error("Failed to fetch the note data.");
        }
    };

    useEffect(() => {
        handleSingleNote();
    }, [id]); // Add id as a dependency to ensure it runs when id changes
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setUpdateNotedata({ ...updateNotedata, [name]: value });
        console.log(name, value);
    };

    const handleSave = async () => {
        const note = updateNotedata;
       
        const response = await Api_Url.put(`updatenote/${id}`, note, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cookies?.token}`
            }
        });
        if (response.data.status === 'success') {
            toast.success(response.data.message,
                {
                    position: "top-right",
                    autoClose: 2000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                }
            );
            navigate('/allnotes')
        } else {
            toast.error(response.data.message);
        }
    }
    return (
        <div>
            <ToastContainer />
            <div className="w-[100%] h-[600px] flex flex-col justify-between bg-[#c8c9cb] rounded-[30px] p-8">
                <div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="font-semibold text-black ps-5 pt-3">
                                Update Note
                                {/* (
                                <input
                                    className="border-b-2 bg-[#282c34] text-white focus:outline-none focus:ring-2 border-none focus:ring-[#282c34]"
                                    type="text"
                                    placeholder="Enter Note Title Here"
                                    value={updateNotedata.title || ""}
                                    onChange={(e) => handleChange(e)}
                                    name="title"
                                />
                                ) */}
                            </h1>
                        </div>
                        <div className="">
                        <button
                               className="bg-green-600 px-4 py-2 rounded-lg text-white" onClick={handleSave}
                            >
                                {/* <Popup handleSave={formik.handleSubmit} disabled={!formik.values.title} title={formik.values.title} setTitle={formik.handleChange} /> */}
                                Update
                            </button>
                        </div>
                    </div>
                    <div className="p-4">
                        <textarea
                            className="w-full h-[450px] p-2 border rounded-lg bg-[#ecedef] text-black focus:outline-none focus:ring-2 border-none focus:ring-gray-400"
                            placeholder="Enter Note Content Here....."
                            onChange={handleChange}
                            name="content"
                            value={updateNotedata.content || ""}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
