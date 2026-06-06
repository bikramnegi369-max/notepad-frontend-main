import "./App.css";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import DashboardLayout from "./component/dashoard/dashboard";
import Notecreate from "./component/page/Notecreate";
import Allnotes from "./component/page/Allnotes";
import Login from "./component/login/login";
import UpdateNote from "./component/page/updateNote";
import useAuth from "./contexts/Auth";
import Message from "./component/page/Message";
import DraftPage from "./component/page/draftPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Notecreate />} />
            <Route path="allnotes" element={<Allnotes />} />
            <Route path="update/:id" element={<UpdateNote />} />
            <Route path="message" element={<Message />} />
            <Route path="draft" element={<DraftPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

const ProtectedRoute = () => {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

const PublicRoute = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  if (auth) {
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
};
