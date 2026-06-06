// src/components/Header.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../contexts/Auth';

const Header = () => {
    const navigate = useNavigate();
    const {cookies,removeCookie,setAuth}=useAuth();

    const handleLogout = () => {
        removeCookie('token', { path: '/' });
        removeCookie('name', { path: '/' });
        removeCookie('userId', { path: '/' });
        setAuth(false);
        navigate("/login", { replace: true });
    };


    return (
        <div className="w-full fixed top-0 left-0 bg-gradient-to-r from-[#390327] to-[#020520] flex items-center justify-between px-6 h-16">
            <Link to="/" className="text-white text-2xl font-bold">
             <img src="image/logo.png" alt="Notes" width={50} height={50} className='ms-4'/>
            </Link>
            <nav className="flex-grow flex justify-center">
                <ul className="flex space-x-6">
                    {/* <li>
                        <Link to="/" className="py-3 px-6 text-white hover:bg-[#390321]">Dashboard</Link>
                    </li> */}
                    <li>
                        <Link to="/" className="py-3 px-6 text-white hover:bg-[#390321]">Add Notes</Link>
                    </li>
                    <li>
                        <Link to="/allnotes" className="py-3 px-6 text-white hover:bg-[#390321]">All Notes</Link>
                    </li>
                    <li>
                        <Link to="/message" className="py-3 px-6 text-white hover:bg-[#390321]">Chat</Link>
                    </li>
                    <li>
                        <Link to="/draft" className="py-3 px-6 text-white hover:bg-[#390321]">Draft</Link>
                    </li>
                    {/* <li>
                        <Link to="#" className="py-3 px-6 text-white hover:bg-[#390321]">Tasks</Link>
                    </li> */}
                </ul>
            </nav>
            <p className='text-white text-lg me-10'>
                Hi : {cookies?.name ?? "user"}
            </p>
            <button  className="py-3 px-6 text-white hover:bg-[#390321] me-4" onClick={handleLogout}>LogOut</button>
        </div>
    );
};

export default Header;
