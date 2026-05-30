import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store";
import { AuthProvider } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import { Login, Register } from "@/pages/Auth";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import CoursePlayer from "@/pages/CoursePlayer";
import Dashboard from "@/pages/Dashboard";
import { Jobs, JobDetail } from "@/pages/Jobs";
import AIAssistant from "@/pages/AIAssistant";
import Chat from "@/pages/Chat";
import { Pricing, PaymentReturn } from "@/pages/Pricing";
import Profile from "@/pages/Profile";
import Quiz from "@/pages/Quiz";
import { CodingChallenges, CodingChallenge } from "@/pages/Coding";
import { Forum, ThreadDetail } from "@/pages/Forum";
import AIQuizGenerator from "@/pages/AIQuizGenerator";
import Badges from "@/pages/Badges";
import MockInterview from "@/pages/MockInterview";
import ResumeParser from "@/pages/ResumeParser";
import Refer from "@/pages/Refer";
import Certificate from "@/pages/Certificate";
import SuperAdmin from "@/pages/SuperAdmin";

function Shell() {
  const loc = useLocation();
  // Generic shell render — no layout, no navigation, no links anywhere.
  if (loc.pathname.startsWith("/private/internal/")) {
    return <SuperAdmin />;
  }
  // Public certificate page — full-bleed, no app layout
  if (loc.pathname.startsWith("/certificate/")) {
    return (
      <Routes>
        <Route path="/certificate/:id" element={<Certificate />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment/return" element={<PaymentReturn />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/learn/:courseId/:lessonId" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
        <Route path="/quiz/:quizId" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
        <Route path="/coding" element={<ProtectedRoute><CodingChallenges /></ProtectedRoute>} />
        <Route path="/coding/:id" element={<ProtectedRoute><CodingChallenge /></ProtectedRoute>} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/:id" element={<ThreadDetail />} />
        <Route path="/ai-quiz" element={<ProtectedRoute roles={["trainer", "admin"]}><AIQuizGenerator /></ProtectedRoute>} />
        <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
        <Route path="/badges" element={<ProtectedRoute><Badges /></ProtectedRoute>} />
        <Route path="/mock-interview" element={<ProtectedRoute><MockInterview /></ProtectedRoute>} />
        <Route path="/resume-parser" element={<ProtectedRoute><ResumeParser /></ProtectedRoute>} />
        <Route path="/refer" element={<ProtectedRoute><Refer /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/chat/:otherId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ReduxProvider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/private/internal/*" element={<SuperAdmin />} />
            <Route path="/*" element={<Shell />} />
          </Routes>
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#09090B", border: "1px solid rgba(255,255,255,0.1)", color: "#fafafa" } }} />
        </AuthProvider>
      </BrowserRouter>
      </ReduxProvider>
    </ErrorBoundary>
  );
}

export default App;
