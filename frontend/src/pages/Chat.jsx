import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, MessageSquare, Paperclip, Circle } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FileUpload from "@/components/FileUpload";

export default function Chat() {
  const { otherId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { connected, online, sendMessage, sendTyping, markRead, onMessage, onTyping } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [other, setOther] = useState(null);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  const loadConvs = () => api.get("/chat/conversations").then((r) => setConversations(r.data || []));
  const loadThread = async () => {
    if (!otherId) return;
    const { data } = await api.get(`/chat/with/${otherId}`);
    setMessages(data.messages || []);
    setOther(data.other_user);
  };

  useEffect(() => { loadConvs(); }, []);
  useEffect(() => { loadThread(); }, [otherId]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, otherTyping]);

  // Subscribe to socket events
  useEffect(() => {
    const off = onMessage((msg) => {
      // append if relevant to current thread, else just refresh sidebar
      const isMine = msg.from_user_id === user.id;
      const inThread = msg.from_user_id === otherId || msg.to_user_id === otherId;
      if (inThread) {
        setMessages((prev) => [...prev, msg]);
        if (!isMine && msg.conversation_id) markRead(msg.conversation_id);
      }
      loadConvs();
    });
    return off;
  }, [otherId, user?.id, onMessage, markRead]);

  useEffect(() => {
    const off = onTyping(({ from_user_id, typing }) => {
      if (from_user_id === otherId) {
        setOtherTyping(typing);
        if (typing) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      }
    });
    return off;
  }, [otherId, onTyping]);

  const send = (attachment_url) => {
    const t = text.trim();
    if (!otherId || (!t && !attachment_url)) return;
    sendMessage(otherId, t, attachment_url);
    setText("");
    sendTyping(otherId, false);
  };

  const handleTyping = (v) => {
    setText(v);
    if (otherId) {
      sendTyping(otherId, !!v);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(otherId, false), 1500);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] h-[calc(100vh-4rem)] bg-zinc-950" data-testid="chat-page">
      <aside className="border-r border-white/5 overflow-y-auto">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h1 className="font-heading text-lg font-medium">Conversations</h1>
          <span data-testid="socket-status" className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${connected ? "text-emerald-400" : "text-zinc-500"}`}>
            <Circle className={`h-2 w-2 ${connected ? "fill-emerald-400 text-emerald-400" : ""}`} />
            {connected ? "live" : "offline"}
          </span>
        </div>
        <div className="p-2">
          {conversations.length === 0 && <div className="p-4 text-xs text-zinc-600">No conversations yet. Visit a course or job to message someone.</div>}
          {conversations.map((c) => {
            const otherUserId = c.participants.find((p) => p !== user.id);
            const otherName = c.participant_names?.[otherUserId] || "Unknown";
            const isOnline = online.has(otherUserId);
            return (
              <button
                key={c.id}
                onClick={() => nav(`/chat/${otherUserId}`)}
                data-testid={`conv-${otherUserId}`}
                className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${otherId === otherUserId ? "bg-indigo-500/10 border border-indigo-500/30" : "hover:bg-zinc-900"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex-shrink-0 flex items-center justify-center text-xs font-semibold">{otherName[0]}</div>
                    {isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-zinc-950" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{otherName}</div>
                    <div className="text-xs text-zinc-500 truncate">{c.last_message}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex flex-col">
        {otherId && other ? (
          <>
            <div className="border-b border-white/5 p-4 flex items-center gap-3">
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-semibold">{other.name[0]}</div>
                {online.has(other.id) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-zinc-950" />}
              </div>
              <div>
                <div className="font-medium">{other.name}</div>
                <div className="text-xs text-zinc-500 capitalize">{other.role} {online.has(other.id) && "• online"}</div>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map((m) => {
                const mine = m.from_user_id === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${mine ? "bg-indigo-500 text-white" : "bg-zinc-900 border border-white/5"}`}>
                      {m.text}
                      {m.attachment_url && (
                        <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block mt-1 text-[11px] underline opacity-80">📎 attachment</a>
                      )}
                      <div className="text-[10px] mt-1 opacity-50">{new Date(m.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })}
              {otherTyping && (
                <div className="flex justify-start" data-testid="typing-indicator">
                  <div className="bg-zinc-900 border border-white/5 rounded-lg px-4 py-2 text-sm flex gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse"></span>
                    <span className="inline-block w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                    <span className="inline-block w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></span>
                  </div>
                </div>
              )}
              {messages.length === 0 && !otherTyping && <div className="text-center text-zinc-500 text-sm pt-12">Start the conversation 👋</div>}
            </div>
            {showUpload && (
              <div className="px-4 pb-2">
                <FileUpload
                  category="document"
                  testId="chat-file-upload"
                  hint="Share a file with this conversation"
                  onUploaded={(r) => { if (r?.full_url) { send(r.full_url); setShowUpload(false); } }}
                />
              </div>
            )}
            <div className="border-t border-white/5 p-4 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowUpload((v) => !v)} className="text-zinc-400 hover:text-white" data-testid="chat-attach">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input data-testid="chat-input" value={text} onChange={(e) => handleTyping(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." className="bg-zinc-900 border-white/10" />
              <Button onClick={() => send()} className="bg-indigo-500 hover:bg-indigo-400" data-testid="chat-send"><Send className="h-4 w-4" /></Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
              <p>Select a conversation to start messaging</p>
              <p className="text-xs mt-2">Powered by Socket.IO with typing indicators & presence</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
