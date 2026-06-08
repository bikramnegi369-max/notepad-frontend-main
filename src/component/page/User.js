import useAuth from "../../contexts/Auth";

const getId = (item) =>
  item?.id || item?._id || item?.sender || item?.to || item?.from || null;

export default function Messageuser({ handleId, userId, users }) {
  const { cookies } = useAuth();
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white p-3 sm:p-4">
      <div className="mb-6 flex items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Messages
          </h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 border border-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {users.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
            No chats available yet.
          </div>
        ) : (
          users.map((e, i) => {
            const id = getId(e);
            const isActive = id && userId === id;
            const displayName =
              e?.name === cookies.name ? "You" : e?.name || "Unknown";
            const preview = e?.lastMessage || e?.message || "No messages yet";
            const time = e?.updatedAt
              ? new Date(e.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return (
              <div
                className="mt-4 cursor-pointer"
                key={id || i}
                onClick={() => handleId(e)}
              >
                <div
                  className={`flex gap-4 items-center rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "bg-blue-50 text-blue-900 p-4 shadow-sm ring-1 ring-blue-100"
                      : "p-4 hover:bg-slate-50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    {e?.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm"></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-[15px] font-bold ${isActive ? "text-blue-900" : "text-slate-800"}`}
                      >
                        {displayName}
                      </p>
                      {time && (
                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                          {time}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p
                        className={`truncate text-sm ${isActive ? "text-blue-700/80" : "text-slate-500"}`}
                      >
                        {preview}
                      </p>
                      {e?.newMessages > 0 && (
                        <div className="flex justify-center items-center text-[10px] font-bold bg-blue-600 text-white min-w-[20px] h-5 px-1.5 rounded-full shadow-sm">
                          {e?.newMessages}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      {e?.isTyping && (
                        <span className="text-[10px] font-bold text-blue-500 italic animate-pulse">
                          typing...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
