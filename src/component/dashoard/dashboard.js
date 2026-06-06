import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../layout/Header'
const DashboardLayout = () => {
  return (
     <>
      <div id="sidebar-top-line"></div>
            <div id="sidebar-right-line"></div>
            <div id="sidebar-bottom-line"></div>
              <Sidebar />
              <div className='w-[100%] ml-auto px-10 py-8 mt-14'>
                <Outlet />
              </div>
    </>
  )
}
export default DashboardLayout