import axios from "axios";
import { useEffect, useState } from "react";
import useAuth from "../../contexts/Auth";
import { MdDeleteOutline } from "react-icons/md";
import ViewNotes from "./ViewNotes";
import { CiEdit } from "react-icons/ci";
import { Link } from "react-router-dom";
import { Api_Url } from "../api/api";
import { RiFindReplaceLine } from "react-icons/ri";

export default function DraftPage() {
    
    const { cookies } = useAuth();
    const [allNotes, setAllNotes] = useState();
 
    
    useEffect(() => {
        const handleUnload = async () => {
            
                try {
                  const response =   await Api_Url.get('draft', {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${cookies?.token}`
                        }
                    });
                    setAllNotes(response.data.data);
                } catch (error) {
                    console.error(error);
                }
            
        };
    handleUnload()

    }
    , []);
 

    const truncateContent = (content, wordLimit) => {
        const words = content.split(' ');
        return words.length > wordLimit ? words.slice(0, wordLimit).join(' ') + ' ...  More' : content;
    };
    console.log(allNotes , "allnotes")
    return (

        <>

<div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Notes</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{
                    allNotes === null || allNotes === undefined? <div className="bg-red-500 text-white p-4 rounded-lg shadow-md">No draft found</div>:<>
                    
                        <div  className="border p-4 rounded-lg shadow-md bg-[#c7c8cb]">
                            <h2 className="text-xl font-semibold text-black">{allNotes?.title}</h2>
                            {/* <p className="text-black">{dateFormat(allNotes?.createdAt, "yyyy/mm/dd")}</p> */}
                            <p className="mt-2 text-black">{allNotes?.content}</p>
                            <div className="mt-2 flex justify-end items-center gap-2">
                                <button>
                                    <Link to={`/`}>
                                    <RiFindReplaceLine className="text-gray-700" size={20} />
                                    </Link>
                                </button>
                            </div>
                        </div>
                    
                    </>
                    }
                    
                </div>
            </div>

        </>
    )

}