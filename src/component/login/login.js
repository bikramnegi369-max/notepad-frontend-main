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
      <div className="flex justify-center items-center h-screen">
        <form
          className="max-w-[400px] w-full mx-auto bg-slate-400 p-10 bg-gradient-to-l from-[#390327] to-[#020520] rounded-xl"
          onSubmit={formik.handleSubmit}
        >
          <div className="mb-5">
            <label
              htmlFor="name"
              className="block mb-2 text-sm font-medium text-white  dark:text-white"
            >
              User Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
              placeholder="Enter User Id"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.name}
            />
            {formik.touched.name && formik.errors.name ? (
              <div className="text-red-600">{formik.errors.name}</div>
            ) : null}
          </div>
          <div className="mb-5">
            <label
              htmlFor="password"
              className="block mb-2 text-sm font-medium text-white dark:text-white"
            >
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
              placeholder="Enter Password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.password}
            />
            {formik.touched.password && formik.errors.password ? (
              <div className="text-red-600">{formik.errors.password}</div>
            ) : null}
          </div>
          <div className="items-center justify-center pt-4 flex">
            <button
              type="submit"
              className="text-white bg-[#390327] hover:bg-[#020520] focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center"
              disabled={formik.isSubmitting}
            >
              Login
            </button>
          </div>
          {formik.errors.api && (
            <div className="text-red-600 mt-4">{formik.errors.api}</div>
          )}
        </form>
      </div>
    </>
  );
}
