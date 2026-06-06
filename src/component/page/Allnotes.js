import { useEffect, useState } from "react";
import { CiEdit } from "react-icons/ci";
import { MdDeleteOutline } from "react-icons/md";
import { Api_Url } from "../api/api";
import { getLocalStorage } from "../util/storage";
import dateFormat from 'dateformat';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ViewNotes from "./ViewNotes";
import { Link } from "react-router-dom";
import useAuth from "../../contexts/Auth";

export default function Allnotes() {
    const [allNotes, setAllNotes] = useState([]);
    const {cookies} = useAuth()
  
    const getAllNotes = async () => {
        try {
            const response = await Api_Url.get('getNotes', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cookies?.token}`
                }
            });
            setAllNotes(response.data.data);
        } catch (error) {
            
        }
      
    };

    useEffect(() => {
        getAllNotes();
    }, []);

    const handleDelete = async (id) => {
        const response = await Api_Url.delete(`deletenote/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cookies?.token}`
            }
        });
        if (response.data.status === 'success') {
            toast.success(response.data.message);
            getAllNotes();
        } else {
            toast.error(response.data.message);
        }
    };

    const truncateContent = (content, wordLimit) => {
        const words = content.split(' ');
        return words.length > wordLimit ? words.slice(0, wordLimit).join(' ') + ' ...  More' : content;
    };


    const handleSearch = async (e)=>{
        const value = e.target.value
        if(value){
            const response = await Api_Url.get(`search/${value}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cookies?.token}`
                }
            });
            setAllNotes(response.data.data);
        }else{
            // getAllNotes();
        }
    }

    return (
        <>
            <ToastContainer />
            <div className="text-center ">

            <input type="text" class="search-input" placeholder="Search Content Notes ...." onChange={handleSearch} />
            </div>

            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Notes</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{
                    allNotes?.length === 0 ? <div className="bg-red-500 text-white p-4 rounded-lg shadow-md">No notes found</div>:<>
                    {allNotes?.map((note, index) => (
                        <div key={index} className="border p-4 rounded-lg shadow-md bg-[#c7c8cb]">
                            <h2 className="text-xl font-semibold text-black">{note?.title}</h2>
                            <p className="text-black">{dateFormat(note?.createdAt, "yyyy/mm/dd")}</p>
                            <p className="mt-2 text-black">{truncateContent(note?.content, 10)}</p>
                            <div className="mt-2 flex justify-end items-center gap-2">
                                <button>
                                    <Link to={`/update/${note?._id}`}>
                                    <CiEdit className="text-gray-700" size={20} />
                                    </Link>
                                </button>
                                <button onClick={() => handleDelete(note?._id)}>
                                    <MdDeleteOutline className="text-red-700" size={20} />
                                </button>
                                <button>
                                    <ViewNotes title={note?.title} content={note?.content} createdAt={note?.createdAt} id={note?._id} />
                                </button>
                            </div>
                        </div>
                    ))}
                    </>
                    }
                    
                </div>
            </div>
        </>
    );
}
