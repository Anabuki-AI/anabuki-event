# Anabuki Event

Anabuki Event is organized as a parent repository with the following Git submodules:

- `backend`: backend application
- `frontend`: frontend application
- `docs`: project documentation

## Clone

```bash
git clone --recurse-submodules https://github.com/Anabuki-AI/anabuki-event.git
```

For an existing clone:

```bash
git submodule update --init --recursive
```

## Local development with mise

The root `mise.toml` pins the shared toolchain and provides project-wide commands for the backend and frontend.

### Prerequisites

- [mise](https://mise.jdx.dev/installing-mise.html)
- Git
- Docker Desktop (for PostgreSQL and Docker-based backend commands)

On Windows, install and activate mise in PowerShell:

```powershell
scoop install mise
Add-Content $PROFILE '(&mise activate pwsh) | Out-String | Invoke-Expression'
. $PROFILE
```

`winget install jdx.mise` is also supported if Scoop is unavailable.

After cloning the repository:

```bash
git submodule update --init --recursive
mise trust
mise install
mise run setup
```

`setup` creates `backend/.env` and `frontend/.env` only when they do not exist, then installs frontend dependencies from `pnpm-lock.yaml`.

### Main commands

| Command | Purpose |
| --- | --- |
| `mise tasks` | List all available commands |
| `mise run dev` | Start backend/PostgreSQL in Docker, then start Nuxt |
| `mise run stop` | Stop backend and PostgreSQL containers |
| `mise run logs` | Follow Docker logs |
| `mise run check` | Run backend tests plus frontend lint, typecheck, and tests |
| `mise run build` | Build backend and frontend |
| `mise run ci` | Run all checks, then both builds |

Useful focused commands include `mise run backend:run`, `mise run backend:test`, `mise run frontend:dev`, and `mise run frontend:check`.

`mise run backend:run` starts PostgreSQL in Docker and runs the API with the mise-managed Java/Maven toolchain. `mise run db:reset` deletes the local PostgreSQL volume and therefore asks for confirmation.

If shell activation is not configured, `mise run ...` still activates the configured tools for each task. Run `mise doctor` to diagnose mise installation or activation issues.
