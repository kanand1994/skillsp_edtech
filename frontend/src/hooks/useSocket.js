/**
 * Socket.IO client hook. Provides:
 *   - connected: bool
 *   - online: Set<user_id>
 *   - sendMessage(toUserId, text, attachmentUrl?)
 *   - sendTyping(toUserId, isTyping)
 *   - markRead(conversationId)
 *   - onMessage(handler) — subscribe to incoming msgs
 *   - onTyping(handler)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(new Set());
  const socketRef = useRef(null);
  const handlersRef = useRef({ message: new Set(), typing: new Set() });

  useEffect(() => {
    const token = localStorage.getItem("skl_token");
    if (!token) return;
    const socket = io(BACKEND_URL, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      // Most likely: invalid/expired JWT (server raises ConnectionRefusedError)
      setConnected(false);
      // Don't spam: only log
      // eslint-disable-next-line no-console
      console.warn("[socket] connect_error", err?.message || err);
    });
    socket.on("presence", ({ user_id, online: isOnline }) => {
      setOnline((prev) => {
        const s = new Set(prev);
        if (isOnline) s.add(user_id); else s.delete(user_id);
        return s;
      });
    });
    socket.on("presence_list", ({ online: list }) => {
      setOnline(new Set(list));
    });
    socket.on("message", (msg) => {
      handlersRef.current.message.forEach((h) => h(msg));
    });
    socket.on("typing", (data) => {
      handlersRef.current.typing.forEach((h) => h(data));
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  const sendMessage = useCallback((to_user_id, text, attachment_url) => {
    socketRef.current?.emit("send_message", { to_user_id, text, attachment_url });
  }, []);

  const sendTyping = useCallback((to_user_id, isTyping) => {
    socketRef.current?.emit("typing", { to_user_id, typing: isTyping });
  }, []);

  const markRead = useCallback((conversation_id) => {
    socketRef.current?.emit("mark_read", { conversation_id });
  }, []);

  const onMessage = useCallback((handler) => {
    handlersRef.current.message.add(handler);
    return () => handlersRef.current.message.delete(handler);
  }, []);

  const onTyping = useCallback((handler) => {
    handlersRef.current.typing.add(handler);
    return () => handlersRef.current.typing.delete(handler);
  }, []);

  return { connected, online, sendMessage, sendTyping, markRead, onMessage, onTyping };
}
