import {
  IoChatbubbleEllipsesOutline,
  IoSearch,
  IoWifiOutline,
} from "react-icons/io5";
import useAuth from "../../contexts/Auth";
import { getDisplayName, getParticipantId } from "../util/chat";

export default function Messageuser({
  handleId,
  userId,
  users,
  search,
  onSearch,
  isConnected,
}) {
  const { cookies } = useAuth();

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              Inbox
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Messages
            </h1>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? "animate-pulse bg-emerald-500" : "bg-slate-400"
              }`}
            ></span>
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>

        <div className="relative">
          <IoSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search conversations"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {users.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            <IoChatbubbleEllipsesOutline
              size={34}
              className="mb-3 text-slate-300"
            />
            <p className="font-semibold text-slate-700">
              No conversations found
            </p>
            <p className="mt-1">Online users and recent chats appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((conversation, index) => {
              const id = getParticipantId(conversation);
              const isActive = id && userId === id;
              const displayName =
                getDisplayName(conversation) === cookies.name
                  ? "You"
                  : getDisplayName(conversation);
              const preview = conversation?.isTyping
                ? "typing..."
                : conversation?.lastMessage || "No messages yet";
              const time = conversation?.updatedAt
                ? new Date(conversation.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                    isActive
                      ? "bg-blue-50 text-blue-950 ring-1 ring-blue-100"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                  key={id || index}
                  onClick={() => handleId(conversation)}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-2xl text-base font-black ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    {conversation?.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-emerald-500 text-white">
                        <IoWifiOutline size={11} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">
                        {displayName}
                      </p>
                      {time && (
                        <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                          {time}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-xs ${
                          conversation?.isTyping
                            ? "font-bold text-blue-600"
                            : "text-slate-500"
                        }`}
                      >
                        {preview}
                      </p>
                      {conversation?.newMessages > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                          {conversation.newMessages > 99
                            ? "99+"
                            : conversation.newMessages}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
