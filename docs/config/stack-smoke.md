# react

- Run: cd frontend && npm run dev -- --port 5173
- Docker: (n/a — no Dockerfile/compose exists for this stack)
- Check: (n/a — static SPA dev server has no health endpoint; verify by loading http://127.0.0.1:5173/ and confirming the dashboard renders)

# fastapi

- Deps: (n/a — SQLite is a local file via DATABASE_URL, no external service to start)
- Migrate: (n/a — no migration tool; schema is created via Base.metadata.create_all on app startup)
- Run: cd backend && uvicorn app.main:app --reload --port 8000
- Docker: (n/a — no Dockerfile/compose exists for this stack)
- Check: http://127.0.0.1:8000/api/health
