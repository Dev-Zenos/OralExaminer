import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { ToastContainer } from 'react-toastify';
import BottomBar from '../components/BottomBar';
import 'react-toastify/dist/ReactToastify.css';

function MainLayout() {
  return (
    <div className='bg-blue-200 min-h-screen flex flex-col'>
      <Navbar />
      <div className='flex-grow'>
        <Outlet />
      </div>
      <ToastContainer />
      <BottomBar className='mt-auto' />
    </div>
  );
}

export default MainLayout;
