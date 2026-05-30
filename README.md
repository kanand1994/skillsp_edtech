# SkillSphere

> **AI-powered Learning Management System + Internship & Job Portal.**
> Learn the skills. Land the job. Built with AI.

Full-stack capstone project: FastAPI backend, React 19 + Redux Toolkit frontend, MongoDB, Socket.IO realtime chat, multi-provider LLM fallback chain (GPT-5.2 → Claude 4.5 → Gemini 3), Stripe payments, gamification, AI mock interviews, resume parser, and job-match scoring.

---

## ✨ Features

### Learners
- 📚 Course catalog with lessons, video player, progress tracking, certificates
- 🎯 Timed quizzes with leaderboards + auto-graded coding challenges (Python, JavaScript, +Piston languages)
- 🤖 **AI Assistant** (6 modes: doubt, code, resume, interview, roadmap, career)
- 🎤 **AI Mock Interview** — multi-turn structured interview with final hire/no-hire report
- 📄 **AI Resume Parser** — extracts skills, experience, education, ATS score (0-100)
- 🔍 **AI Job-Match Score** — paste resume against any job → match % + missing skills
- 🏆 **Gamification** — XP, levels, 13 badges (bronze/silver/gold/platinum), daily streaks, global leaderboard
- 💼 Apply to internships and jobs, message recruiters in real-time
- 💳 Stripe subscription (monthly/yearly/lifetime) or pay-per-course

### Trainers
- Publish courses with thumbnails, lessons, video embeds
- **AI quiz generator** from course content
- Grade assignments, review submissions

### Recruiters
- Post jobs/internships, manage applicants (applied/shortlisted/interview/rejected/hired)
- Direct chat with candidates

### Admins
- Platform analytics with Recharts (users, revenue, growth, category breakdown)
- Full CRUD on users, courses, jobs, forum threads, coding challenges, quizzes
- User moderation, ban/unban

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 19, Redux Toolkit, Tailwind CSS, Shadcn UI, Framer Motion, Recharts, Socket.IO client |
| **Backend** | FastAPI (Python 3.11), Motor (async MongoDB), Socket.IO ASGI, emergentintegrations |
| **Database** | MongoDB (Atlas in production, local for dev) |
| **AI** | Emergent Universal LLM Key — GPT-5.2 → Claude Sonnet 4.5 → Gemini 3 Flash fallback chain |
| **Payments** | Stripe Checkout + webhooks |
| **Email** | Resend |
| **Realtime** | Socket.IO (mounted at `/api/socket.io`) |
| **Code execution** | Self-hosted Piston (Docker) + local Python/JS sandbox fallback |
| **DevOps** | Docker, docker-compose, Nginx, Kubernetes manifests, Prometheus + Grafana, GitHub Actions (5 workflows) |
| **Deployment target** | AWS EC2 (free tier) + ECR |

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or Atlas)
- (Optional) Docker for Piston code execution sandbox

### Setup

```bash
# Clone
git clone https://github.com/<your-username>/skillsphere.git
cd skillsphere

# Backend
cp backend/.env.example backend/.env
# → Edit backend/.env: fill in MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, STRIPE_API_KEY, SMTP_*
cd backend
pip install -r requirements.txt
python seed.py             # seeds demo users + courses + jobs
python seed_forum.py       # seeds forum threads
python seed_coding.py      # seeds coding challenges
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (in a new terminal)
cp frontend/.env.example frontend/.env
# → Edit frontend/.env: set REACT_APP_BACKEND_URL=http://localhost:8001
cd frontend
yarn install
yarn start                  # opens http://localhost:3000
```

### Demo accounts (seeded by `seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@skillsphere.demo` | `Admin@123` |
| Trainer | `trainer1@skillsphere.demo` | `Trainer@123` |
| Recruiter | `recruiter@skillsphere.demo` | `Recruiter@123` |
| Student | `student@skillsphere.demo` | `Student@123` |

Stripe test card: **4242 4242 4242 4242**, any future expiry, any CVC.

---

## 🔐 Environment Variables

See `backend/.env.example` and `frontend/.env.example` for full lists and inline comments.

### Quick key acquisition

| Variable | Where to get it |
|---|---|
| `MONGO_URL` | Local: `mongodb://localhost:27017` • Cloud: https://cloud.mongodb.com (free M0) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `EMERGENT_LLM_KEY` | Emergent profile → Universal Key |
| `STRIPE_API_KEY` | https://dashboard.stripe.com/test/apikeys (test) or live keys |
| `SMTP_*` | See `DEPLOYMENT.md` for Gmail / SendGrid / SES setup |

---

## 🐳 Docker

```bash
docker-compose up --build
# Backend: http://localhost:8001
# Frontend: http://localhost:80 (via nginx)
# MongoDB:  localhost:27017
# Piston:   localhost:2000
# Grafana:  localhost:3001
# Prometheus: localhost:9090
```

---

## ☁️ Production Deployment (AWS)

1. **Set GitHub Actions secrets** (Repo → Settings → Secrets and variables → Actions): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, plus all app env vars from `.env.example`.
2. Bootstrap EC2 instance: `bash scripts/aws-bootstrap.sh`.
3. Push to `main` — `.github/workflows/aws-deploy.yml` will build, push to ECR, and SSH-deploy to EC2.
4. (Optional) `bash scripts/setup-github-secrets.sh` reads a local `.secrets` file (gitignored) and pushes all secrets via `gh secret set` in one command.

Kubernetes manifests under `kubernetes/` (Deployment, HPA, Ingress, ConfigMap, Secret).

---

## 🧪 Testing

```bash
# Backend pytest
cd backend
python -m pytest tests/ -v
# → 89/90 cases pass across auth, courses, jobs, payments, AI, gamification, mock interview, resume parser

# Frontend lint
cd frontend
yarn lint
```

---

## 📁 Project Structure

```
.
├── backend/
│   ├── routes/         # FastAPI routers: auth, courses, learning, jobs, ai, ai_quiz, chat,
│   │                   #   payments, admin, uploads, coding, forum, gamification
│   ├── auth.py         # JWT, bcrypt, role middleware
│   ├── db.py           # Motor async MongoDB client
│   ├── sockets.py      # Socket.IO event handlers
│   ├── email_service.py # Resend wrapper (placeholder mode when key blank)
│   ├── server.py       # FastAPI app + Socket.IO ASGI mount
│   ├── seed*.py        # Demo data seeders
│   └── tests/          # pytest suites
├── frontend/
│   ├── src/
│   │   ├── pages/      # Landing, Auth, Courses, CourseDetail, CoursePlayer, Dashboard,
│   │   │               #   Jobs, JobDetail, AIAssistant, AIQuizGenerator, Chat, Pricing,
│   │   │               #   Profile, Quiz, Coding, Forum, Badges, MockInterview, ResumeParser
│   │   ├── components/ # Layout, ProtectedRoute, ErrorBoundary, FileUpload, Markdown, AdminConsole
│   │   ├── context/    # AuthContext (Redux-backed facade)
│   │   ├── hooks/      # useSocket
│   │   ├── store/      # Redux Toolkit: index.js, authSlice.js
│   │   └── lib/        # api.js (axios + interceptors), errors.js
│   └── craco.config.js
├── .github/workflows/  # 5 CI/CD pipelines
├── kubernetes/         # K8s manifests
├── scripts/            # AWS bootstrap, Piston installer, GH secrets uploader
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml
```

---

## 🗺 Roadmap

- [x] JWT auth + 4 roles (Student / Trainer / Recruiter / Admin)
- [x] Redux Toolkit state management
- [x] Course catalog, lessons, progress, certificates
- [x] Quizzes + leaderboards + assignments
- [x] Coding playground with sandboxed execution
- [x] AI Assistant (6 modes) + AI Quiz Generator
- [x] Job/internship portal + applications
- [x] Stripe Checkout (subscription + per-course)
- [x] Socket.IO realtime chat with presence + typing
- [x] SMTP email notifications (Gmail / SendGrid / SES — provider-agnostic)
- [x] Drag-and-drop file uploads (avatars, thumbnails, lesson videos, resumes)
- [x] Forum/discussions with upvotes, accepted answers, admin pin/lock
- [x] AI Mock Interview (multi-turn) + Resume Parser + Job-Match Score
- [x] Gamification (XP, 13 badges, streaks, leaderboard)
- [x] Recharts admin analytics
- [x] Dockerized + K8s manifests + 5 GitHub Actions workflows
- [ ] Mobile PWA support
- [ ] Multi-language i18n
- [ ] Live cohort sessions (WebRTC)

---

## 📝 License

MIT.

## 🙏 Acknowledgments

Built with [FastAPI](https://fastapi.tiangolo.com/), [React](https://react.dev/), [Shadcn UI](https://ui.shadcn.com/) and [Recharts](https://recharts.org/)
