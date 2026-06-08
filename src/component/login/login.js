import React from "react";
import Api_Url from "../api/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import useAuth from "../../contexts/Auth";
import { useLocation, useNavigate } from "react-router-dom";

export default function Login() {
  const { login, setCookie } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const validationSchema = Yup.object({
    name: Yup.string().required("User Name is required"),
    password: Yup.string().required("Password is required"),
  });

  const formik = useFormik({
    initialValues: {
      name: "",
      password: "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        const response = await Api_Url.post("login", values, {
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (response.data.status === "success") {
          const token = response.data.data.token;
          // use auth helper to set token and axios header
          login(token, {
            path: "/",
            expires: new Date(Date.now() + 60 * 60 * 1000),
          });
          // store basic user info in cookies as before
          setCookie("name", response.data.data.name, { path: "/" });
          setCookie("userId", response.data.data.id, { path: "/" });
          toast.success(response.data.message);
          setTimeout(() => {
            navigate(from, { replace: true });
          }, 1200);
        } else {
          toast.error(response.data.message);
        }
      } catch (err) {
        const message = err.response?.data?.message || "Unable to login";

        toast.error(message);
        setErrors({ api: message });
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <>
      <ToastContainer />
      <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img
              src="image/logo.png"
              alt="Notepad logo"
              className="h-16 w-16 rounded-2xl border border-slate-200 shadow-sm object-cover"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Sign in to Notepad
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Notes, drafts & chat in one place
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-xl sm:px-10">
            <form className="space-y-6" onSubmit={formik.handleSubmit}>
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-slate-700"
                >
                  User Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    className="block w-full appearance-none rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:text-sm"
                    placeholder="Enter your username"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.name}
                  />
                </div>
                {formik.touched.name && formik.errors.name && (
                  <p className="mt-2 text-sm text-red-600">
                    {formik.errors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="password"
                    id="password"
                    className="block w-full appearance-none rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:text-sm"
                    placeholder="••••••••"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                  />
                </div>
                {formik.touched.password && formik.errors.password && (
                  <p className="mt-2 text-sm text-red-600">
                    {formik.errors.password}
                  </p>
                )}
              </div>

              {formik.errors.api && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {formik.errors.api}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.98]"
                  disabled={formik.isSubmitting}
                >
                  {formik.isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
