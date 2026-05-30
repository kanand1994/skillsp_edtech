/**
 * useAuth() hook — backed by Redux Toolkit.
 *
 * This file used to expose a React Context-based AuthProvider. State has been
 * migrated to Redux Toolkit (see /src/store/authSlice.js) but the original
 * `useAuth()` API is preserved here as a thin facade so consuming pages don't
 * need to change. <AuthProvider/> is kept as a no-op for backward compat — the
 * real provider is now <Provider store={store}/> mounted in App.js.
 */
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loginThunk,
  registerThunk,
  refreshThunk,
  bootstrapThunk,
  logout as logoutAction,
  setUser as setUserAction,
} from "@/store/authSlice";

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(bootstrapThunk());
  }, [dispatch]);
  return <>{children}</>;
};

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((s) => s.auth);

  const login = async (email, password) => {
    const res = await dispatch(loginThunk({ email, password }));
    if (res.error) throw new Error(res.payload || res.error.message);
    return res.payload;
  };

  const register = async (payload) => {
    const res = await dispatch(registerThunk(payload));
    if (res.error) throw new Error(res.payload || res.error.message);
    return res.payload;
  };

  const refresh = async () => {
    const res = await dispatch(refreshThunk());
    if (res.error) throw new Error(res.payload || res.error.message);
    return res.payload;
  };

  const logout = () => dispatch(logoutAction());
  const setUser = (u) => dispatch(setUserAction(u));

  return { user, loading, login, register, logout, refresh, setUser };
};
