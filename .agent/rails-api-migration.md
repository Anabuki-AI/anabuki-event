# Rails API migration

- Worktree branch: `feat/rails-api-migration` (based on the supplied local integration commit `33ba30b`, whose backend gitlink was `ecc66a0`). The root `main` checkout and its untracked `.agent/` files/`nul` were not changed.
- Replacement repository: `https://github.com/Anabuki-AI/anabuki-event-backend-rails` (private, `main` at `a657246`).
- Rails preserves the existing Nuxt routes and JSON field names: health, users, Google OAuth, admin session, applicant approval/exchange, request queue, and management access.
- Rails intentionally uses `anabuki_event_rails_*`, port `5433` in the parent example, and volume `rails-postgres-data`; it does not run Flyway or reuse the Java database/volume.
- Local Ruby 3.4.7 was installed through mise. `zeitwerk:check`, RuboCop, and Brakeman passed locally. GitHub Actions run `34140787856` passed Brakeman, RuboCop, and all Rails/PostgreSQL tests. Local Docker build/start could not run because Docker Desktop was launched but its engine did not become available; PostgreSQL was not reachable.
- Follow-up before merging/deploying: execute Rails tests and compose smoke tests with Docker available, configure real Google OAuth/secret-store values, review the separate production data-migration plan, and configure `PARENT_REPOSITORY_TOKEN` if automatic gitlink updates after Rails `main` CI are desired.
