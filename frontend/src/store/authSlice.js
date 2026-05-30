import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

const cachedUser = (() => {
  try { return JSON.parse(localStorage.getItem("skl_user") || "null"); } catch { return null; }
})();
const cachedToken = localStorage.getItem("skl_token");

export const loginThunk = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("skl_token", data.token);
      localStorage.setItem("skl_user", JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || err.message);
    }
  }
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("skl_token", data.token);
      localStorage.setItem("skl_user", JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || err.message);
    }
  }
);

export const refreshThunk = createAsyncThunk(
  "auth/refresh",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("skl_user", JSON.stringify(data));
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || err.message);
    }
  }
);

export const bootstrapThunk = createAsyncThunk(
  "auth/bootstrap",
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem("skl_token");
    if (!token) return null;
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("skl_user", JSON.stringify(data));
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || err.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: cachedUser,
    token: cachedToken,
    loading: !!cachedToken, // only "loading" while we re-verify a cached token
    error: null,
  },
  reducers: {
    logout(state) {
      localStorage.removeItem("skl_token");
      localStorage.removeItem("skl_user");
      state.user = null;
      state.token = null;
      state.error = null;
    },
    setUser(state, action) {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem("skl_user", JSON.stringify(action.payload));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) state.user = action.payload;
      })
      .addCase(bootstrapThunk.rejected, (state) => {
        state.loading = false;
        // Token was invalid (or network down). Drop any stale cached user.
        localStorage.removeItem("skl_token");
        localStorage.removeItem("skl_user");
        state.user = null;
        state.token = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.token = localStorage.getItem("skl_token");
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.token = localStorage.getItem("skl_token");
      })
      .addCase(refreshThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
