# 🧠 KnowledgeAI — Production-Ready RAG Knowledge Base

A full-stack AI Knowledge Base application where users upload documents and chat with their data using Retrieval-Augmented Generation (RAG). Similar to ChatPDF + NotebookLM + Chatbase.

---

## 🚀 Features

### Document Management

- Upload PDF, DOCX, TXT, CSV, JSON, Markdown, Images (JPG/PNG/WEBP), ZIP
- Drag-and-drop multi-file upload with real-time progress
- Automatic OCR for images and scanned PDFs (Tesseract.js)
- AI-generated summaries, tags, and keywords
- Rename, delete, retry failed processing
- Background processing queue (Bull + Redis)

### RAG Chat

- GPT-4o powered real-time streaming responses (SSE)
- Full markdown + code highlighting support
- Source citations with document name and page number
- "I couldn't find this" — no hallucinations
- Voice input (Web Speech API)
- Export chat to PDF or Markdown
- Chat history with rename/delete

### Search

- **Semantic search** — meaning-based vector similarity
- **Keyword search** — traditional full-text
- **Hybrid search** — best of both worlds
- Filter by file type, date, tags

### Workspaces

- Multiple isolated workspaces per user
- Per-workspace documents, chats, members
- Role-based access (Owner, Admin, Member)

### Authentication & Security

- JWT access + refresh tokens
- Role-based access control (USER, ADMIN, SUPER_ADMIN)
- Rate limiting, helmet, CORS
- Bcrypt password hashing
- Input validation & file type/size validation

### Admin Panel

- User management (activate/deactivate/delete)
- System-wide usage analytics
- Cost tracking per model
- Storage monitoring
- Usage logs

---

## 🛠 Tech Stack

| Layer     | Technology                                             |
| --------- | ------------------------------------------------------ |
| Frontend  | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| Backend   | NestJS, TypeScript, Prisma ORM                         |
| Database  | PostgreSQL                                             |
| Vector DB | Qdrant                                                 |
| AI        | OpenAI GPT-4o + text-embedding-3-large                 |
| Queue     | Bull + Redis                                           |
| Auth      | JWT + Passport                                         |
| Docs      | Swagger/OpenAPI                                        |
| Deploy    | Docker + Docker Compose                                |

---

## 🏃 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- OpenAI API key

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 2. Start all services
docker-compose up -d

# 3. Open the app
open http://localhost:3000
```

Default admin: `admin@example.com` / `Admin@123456`

### Option 2: Manual Setup

**Start infrastructure:**

```bash
docker-compose up -d postgres redis qdrant
```

**Backend:**

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, OPENAI_API_KEY, JWT_SECRET, etc.

npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
npm run start:dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## 📁 Project Structure

```
rag-knowledge-base/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/              # JWT auth, strategies, guards
│   │   ├── users/             # User management
│   │   ├── documents/         # Upload, processing, OCR
│   │   ├── chat/              # RAG chat with streaming
│   │   ├── search/            # Hybrid search
│   │   ├── workspaces/        # Multi-workspace
│   │   ├── admin/             # Admin panel APIs
│   │   ├── settings/          # System settings
│   │   ├── embeddings/        # OpenAI + Qdrant
│   │   ├── storage/           # Local/S3 storage
│   │   ├── queue/             # Bull job queues
│   │   └── prisma/            # Database service
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Initial data seed
│   └── Dockerfile
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── pages/             # Route pages
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── dashboard/     # Stats overview
│   │   │   ├── documents/     # Upload & manage
│   │   │   ├── chat/          # Conversations
│   │   │   ├── search/        # Hybrid search
│   │   │   ├── workspaces/    # Workspace management
│   │   │   ├── admin/         # Admin panel
│   │   │   └── settings/      # Profile & settings
│   │   ├── components/        # Reusable UI components
│   │   ├── services/          # API client (axios)
│   │   ├── store/             # Zustand state management
│   │   └── utils/             # Helper functions
│   ├── nginx.conf             # Production nginx config
│   └── Dockerfile
│
└── docker-compose.yml         # Full stack orchestration
```

---

## 🔌 API Documentation

After starting the backend, visit:

- **Swagger UI**: http://localhost:3001/docs

### Key Endpoints

| Method | Path                    | Description               |
| ------ | ----------------------- | ------------------------- |
| POST   | /api/auth/register      | Create account            |
| POST   | /api/auth/login         | Login                     |
| POST   | /api/documents/upload   | Upload document           |
| GET    | /api/documents          | List documents            |
| POST   | /api/chats              | Create chat               |
| POST   | /api/chats/:id/messages | Send message (SSE stream) |
| GET    | /api/search?q=query     | Hybrid search             |
| GET    | /api/workspaces         | List workspaces           |
| GET    | /api/admin/dashboard    | Admin stats               |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable                 | Description                  | Default                  |
| ------------------------ | ---------------------------- | ------------------------ |
| `DATABASE_URL`           | PostgreSQL connection string | Required                 |
| `OPENAI_API_KEY`         | OpenAI API key               | Required                 |
| `JWT_SECRET`             | JWT signing secret           | Required                 |
| `JWT_REFRESH_SECRET`     | Refresh token secret         | Required                 |
| `QDRANT_URL`             | Qdrant server URL            | `http://localhost:6333`  |
| `REDIS_HOST`             | Redis host                   | `localhost`              |
| `OPENAI_MODEL`           | Chat model                   | `gpt-4o`                 |
| `OPENAI_EMBEDDING_MODEL` | Embedding model              | `text-embedding-3-large` |
| `MAX_FILE_SIZE`          | Max upload size (bytes)      | `52428800` (50MB)        |
| `STORAGE_TYPE`           | `local` or `s3`              | `local`                  |

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend && npm test

# Backend coverage
cd backend && npm run test:cov
```

---

## 🚢 Production Deployment

1. Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
2. Set `OPENAI_API_KEY`
3. Configure `STORAGE_TYPE=s3` with AWS credentials for scalable storage
4. Use a managed PostgreSQL (RDS, Supabase, Neon)
5. Use a managed Redis (ElastiCache, Upstash)
6. Deploy Qdrant Cloud or self-hosted cluster

```bash
docker-compose -f docker-compose.yml up -d --build
```

---

## 📄 License

MIT

#
