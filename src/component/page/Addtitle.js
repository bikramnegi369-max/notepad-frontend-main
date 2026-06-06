import { useState } from "react";

export default function Popup({handleSave,setTitle,title,disabled}) {
  const [isOpen, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        onClick={() => setOpen(true)}
      >
        Save
      </button>

      <div>
        {isOpen && (
          <div
            className="fixed inset-0 bg-[#464749bd] bg-opacity-75 transition-opacity"
            onClick={() => setOpen(false)}
          ></div>
        )}

        {isOpen && (
          <div className="fixed inset-0 z-10 overflow-y-auto ">
            <div className="flex min-h-full  items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div
                className="relative transform overflow-hidden rounded-lg  text-left transition-all w-[80%] sm:my-8 sm:w-full sm:max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-[70%] ml-auto bg-[#c8c9cb] px-4 pt-5 pb-4 sm:p-6 sm:pb-4 rounded-2xl">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3
                        className="text-lg font-medium leading-6 text-black"
                        id="modal-title"
                      >
                        Add File Name
                      </h3>
                      <div className="mt-2">
                        <input
                          className="border-b-2 py-2 px-10 rounded-lg bg-[#dfe0e2] text-black focus:outline-none focus:ring-2 border-none focus:ring-[#282c34]"
                          type="text"
                          name="title"
                          placeholder="Enter File Name"
                          onChange={setTitle}
                          value={title || ''}

                        />
                      </div>
                      <div className="flex justify-center mt-4">
                        <button
                          type="submit"
                          // onClick={onSubmit}
                          className={`${disabled ? 'opacity-30 cursor-not-allowed' : ''} bg-[#384355] text-white py-2 px-4 rounded-md`}
                          disabled={disabled}
                          onClick={()=>{return handleSave() , setOpen(false)}}
                        >
                        {
                          disabled ? 'Enter File Name' : "Submit"
                        }
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
