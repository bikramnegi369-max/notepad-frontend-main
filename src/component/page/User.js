import useAuth from "../../contexts/Auth";

const getId = (item) =>
  item?.id || item?._id || item?.sender || item?.to || item?.from || null;

export default function Messageuser({ handleId, userId, users }) {
  const { cookies } = useAuth();
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-slate-50 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Chats</h1>
          <p className="text-sm text-slate-500">
            Tap a contact to open the conversation.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Live
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
                  className={`pb-3 flex gap-4 items-start rounded-2xl transition ${
                    isActive
                      ? "bg-[#2F0326] text-white p-3"
                      : "border-b p-3 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-semibold ${
                      isActive
                        ? "bg-white text-[#280f23]"
                        : "bg-[#280f23] text-white"
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {displayName}
                      </p>
                      {e?.newMessages > 0 && (
                        <div className="flex justify-center items-center text-xs bg-[#e1dde1] text-[#280f23] w-6 h-6 rounded-full">
                          {e?.newMessages}
                        </div>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500 mt-1">
                      {preview}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                      {e?.isOnline && (
                        <span className="text-green-600">Online</span>
                      )}
                      {e?.isTyping && (
                        <span className="text-slate-500">typing...</span>
                      )}
                      {time && <span>{time}</span>}
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
