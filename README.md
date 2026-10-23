# ci-cd-learning-api

A small NestJS REST API built to learn CI/CD from zero:

- a real (but deliberately simple) TypeScript application
- unit and end-to-end tests
- a GitHub Actions pipeline
- a production Docker image built with Podman
- a free public deployment on Render

> **The tasks are stored in memory.** Every task disappears when the Node.js
> process restarts. This is intentional: the first version has no database, so
> there is no service to install, pay for or secure. Persistence is a separate
> exercise.

## Contents

- [Architecture](#architecture)
- [API](#api)
- [Project structure](#project-structure)
- [Requirements and Node versions](#requirements-and-node-versions)
- [Local development](#local-development)
- [Tests and quality checks](#tests-and-quality-checks)
- [Local container with Podman](#local-container-with-podman)
- [CI with GitHub Actions](#ci-with-github-actions)
- [CD with Render](#cd-with-render)
- [Smoke test](#smoke-test)
- [Logs, failures and rollback](#logs-failures-and-rollback)
- [Git workflow](#git-workflow)
- [Learning stages checklist](#learning-stages-checklist)
- [Security notes](#security-notes)

## Architecture

CI and CD are different jobs:

- **CI (Continuous Integration)** checks that the code is healthy: lint, unit
  tests, end-to-end tests and a production build.
- **CD (Continuous Deployment)** publishes the application after CI succeeds.

```text
Developer on Omarchy Linux
        |
        | git push / pull request
        v
GitHub repository
        |
        |-- pull request --------------------+
        |                                    v
        |                         GitHub Actions: CI
        |                         lint -> unit -> e2e -> build
        |                                    |
        |-- push to main --------------------+
                                             |
                                             | CI checks pass
                                             v
                                  Render: CD (Docker build)
                                             |
                                             v
                              https://<service>.onrender.com
                                             |
                                             v
                         GET /health (Render health check + smoke test)
```

The local lerd environment is for development only. It is not part of CD.

## API

| Method   | Path          | Success | Description                    |
| -------- | ------------- | ------- | ------------------------------ |
| `GET`    | `/`           | `200`   | Application information        |
| `GET`    | `/health`     | `200`   | Health check used by Render    |
| `POST`   | `/tasks`      | `201`   | Create a task                  |
| `GET`    | `/tasks`      | `200`   | List all tasks                 |
| `GET`    | `/tasks/:id`  | `200`   | Get one task                   |
| `PATCH`  | `/tasks/:id`  | `200`   | Update title, description or completed |
| `DELETE` | `/tasks/:id`  | `204`   | Delete a task                  |

Unknown task IDs return `404`. Invalid payloads return `400`.

### Task shape

```json
{
  "id": "5af50a1a-705a-4f65-83a4-8579852aad56",
  "title": "Learn CI/CD",
  "description": "Optional description",
  "completed": false,
  "createdAt": "2026-10-23T15:08:25.508Z",
  "updatedAt": "2026-10-23T15:08:25.508Z"
}
```

### Validation

`class-validator` and `class-transformer` validate every request body:

- `title` is required, non-blank and at most 200 characters
- `description` is optional and at most 2000 characters
- `completed` must be a boolean
- unknown fields are rejected (`forbidNonWhitelisted`)
- leading and trailing spaces are removed from titles
- optional fields may be omitted, but `null` is rejected

The global `ValidationPipe` is registered through `APP_PIPE` in
`src/app.module.ts`, so the same rules apply in tests and in production.

### Example requests

```bash
BASE_URL=http://ci-cd-learning-api.test

curl "$BASE_URL/"
curl "$BASE_URL/health"

curl -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn GitHub Actions","description":"First workflow"}'

curl "$BASE_URL/tasks"
```

PATCH and DELETE need the ID returned by `POST`:

```bash
curl -X PATCH "$BASE_URL/tasks/<id>" \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'

curl -X DELETE "$BASE_URL/tasks/<id>"
```

## Project structure

```text
src/
  main.ts                     starts Nest, reads PORT/HOST
  app.module.ts               root module + global validation
  app.controller.ts           GET / and GET /health
  app.service.ts              API metadata and health payload
  app.controller.spec.ts      unit tests
  tasks/
    tasks.module.ts
    tasks.controller.ts       REST routes
    tasks.service.ts          in-memory Map
    tasks.service.spec.ts     unit tests
    dto/create-task.dto.ts
    dto/update-task.dto.ts
    entities/task.entity.ts
test/
  app.e2e-spec.ts             full HTTP lifecycle tests
.github/workflows/ci.yml      GitHub Actions CI
Dockerfile                    multi-stage production image
.dockerignore
Containerfile.lerd            lerd development image
.lerd.yaml                    lerd custom-container site
render.yaml                   Render Blueprint (free Docker service)
scripts/smoke-test.sh         post-deployment health check
```

## Requirements and Node versions

- Node.js 22 LTS (the project pins it in `.node-version`)
- npm
- Git
- Podman (optional for the local container, required for the container stage)
- A GitHub account
- A Render account (free) for the public deployment

The current host has Node.js `26.12.1`, which is newer than the project runtime.
That is fine for running commands locally, but the container and CI use
**Node.js 22** so the results are reproducible. Do not assume that a newer host
version behaves exactly like the CI runtime.

If a package or platform drops Node.js 22 support later, update all of these
together:

- `.node-version`
- the `node:22-bookworm-slim` images in `Dockerfile`
- `node-version: 22` in `.github/workflows/ci.yml`
- the `engines` field in `package.json`

## Local development

```bash
npm ci
npm run start:dev
```

The application listens on `http://localhost:3000` by default. It reads
`process.env.PORT` and binds to `0.0.0.0` so it also works inside containers.

### With lerd

This folder is already linked as a lerd custom-container site:

- `.lerd.yaml` declares the domain and container port `3000`
- `Containerfile.lerd` runs `npm run start:dev`
- lerd runs the container `lerd-custom-ci-cd-learning-api` and proxies
  `ci-cd-learning-api.test` to it

Useful commands:

```bash
curl http://ci-cd-learning-api.test/health
podman logs -f lerd-custom-ci-cd-learning-api
```

Because the project directory is mounted into the container, editing a source
file triggers the Nest watch mode. If a watch restart fails with
`EADDRINUSE`, restart the lerd site from the lerd dashboard; the old process was
still holding port 3000.

The local site uses HTTP. Public HTTPS is provided by Render after deployment.

## Tests and quality checks

```bash
npm run lint        # oxlint, type-aware
npm test            # unit tests (Vitest)
npm run test:e2e    # end-to-end HTTP tests (Vitest + supertest)
npm run build       # TypeScript -> dist/
```

Current test count:

- 11 unit tests
- 6 end-to-end tests

The e2e suite exercises the full task lifecycle, validation errors, `404`
responses and the health endpoint. It does not open a real network port; it
uses Nest's HTTP server through supertest.

Prettier is available for formatting:

```bash
npm run format
```

## Local container with Podman

### Image vs container

- An **image** is the immutable template built from the `Dockerfile`.
- A **container** is a running instance of that image.

Building the same image twice with the same inputs should produce the same
application. Starting two containers from one image gives two independent
processes and two independent in-memory stores.

### Build

```bash
podman build -t ci-cd-learning-api:local .
```

The `Dockerfile` has three stages:

1. `deps`: install **all** dependencies with `npm ci`.
2. `build`: compile TypeScript with `npm run build`.
3. `production`: install only production dependencies, copy `dist/`, drop to
   the unprivileged `node` user and run `node dist/main.js`.

Development dependencies and test files are not part of the final image. No
`.env` file or secret is copied into the image.

### Run

```bash
podman run --rm --name ci-cd-learning-api-local \
  -p 127.0.0.1:3001:3000 \
  ci-cd-learning-api:local
```

The image defaults to `PORT=3000`. The host port is `3001` to avoid clashing
with other local tools.

```bash
curl http://127.0.0.1:3001/health
```

### Logs and stop

```bash
podman logs -f ci-cd-learning-api-local
podman stop ci-cd-learning-api-local
```

The container is reachable only from this machine because the port is bound to
`127.0.0.1`. It has no public URL, no managed TLS and no automatic deployment.
That is the difference between a local container and public hosting.

## CI with GitHub Actions

Workflow: `.github/workflows/ci.yml`.

Triggers:

- every push to every branch (`branches: ['**']`)
- every pull request targeting `main`

Steps:

1. `actions/checkout@v7` clones the repository.
2. `actions/setup-node@v7` installs Node.js 22 and enables npm caching.
3. `npm ci` installs exactly what `package-lock.json` describes.
4. `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` run in that
   order.
5. Any non-zero exit code fails the job immediately; later steps do not run.

Important YAML keys:

- `permissions: contents: read`: least privilege; the pipeline cannot write to
  the repository.
- `concurrency`: a new push to the same branch cancels the previous run.
- `timeout-minutes: 15`: prevents a hung job from running forever.
- `cache: npm`: caches the npm download cache, not `node_modules`; `npm ci`
  still installs from the lockfile.
- `CI: true`: tells tools they are in a non-interactive CI environment.

The runner is a fresh GitHub-hosted Ubuntu virtual machine. Nothing from your
laptop is reused, which is why `npm ci` and the lockfile matter.

### Where to read logs

GitHub repository -> **Actions** -> select a workflow run -> select the
`Lint, test and build` job -> expand a step.

The first failing step contains the useful error. Reproduce it locally with the
same command before changing code.

### Common CI failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm ci` fails with lockfile mismatch | `package.json` changed without updating `package-lock.json` | run `npm install`, commit the lockfile |
| lint fails | formatting/type-aware rule | run `npm run lint` locally |
| unit or e2e test fails | behaviour changed without updating tests | run `npm test` / `npm run test:e2e` |
| build fails | TypeScript error | run `npm run build` |
| test passes locally but fails in CI | different Node version or state leaking between tests | use Node 22 and isolated test setup |

### Practice the failure path

This is the Stage 6/7 exercise. On a feature branch:

```bash
# deliberately break one assertion in src/tasks/tasks.service.spec.ts
npm test                 # observe a local failure
git add .
git commit -m "test: break an assertion on purpose"
git push
```

Open the pull request and watch CI fail. Fix the assertion, push again, and
watch CI pass. Do not merge while the check is red.

## CD with Render

### Why Render

Render offers a documented **free** web-service plan and supports Docker.
According to Render's official free-plan documentation:

- free web services spin down after **15 minutes without traffic**
- the next request takes about **one minute** to wake the service
- each workspace gets **750 free instance hours per month**
- the filesystem is ephemeral; it is lost on every deploy, restart or spin-down
- free services have no shell access and no persistent disk
- rollback is available only to the **two most recent previous deploys**
- free services are not suitable for production

The official first-deploy tutorial says no payment is required. However, Render
may request card details for anti-abuse verification on some accounts. **No
provider can be promised to stay free or cardless forever.** Check the current
official pages before signing up:

- <https://render.com/docs/free>
- <https://render.com/docs/blueprint-spec>
- <https://render.com/docs/your-first-deploy>

If you are asked for a card and do not want to provide one, use the local
Podman deployment above. The application, tests, CI, Docker image and smoke
test still work; only the public HTTPS URL is missing.

### Deploy steps

1. Push this repository to GitHub with `main` as the default branch.
2. Sign in to Render with GitHub.
3. Dashboard -> **New** -> **Blueprint**.
4. Select the repository. Render reads `render.yaml`.
5. Apply the Blueprint and wait for the Docker build.
6. Open the generated `https://<service>.onrender.com` URL.
7. Run the smoke test (below).

`render.yaml` configures:

```yaml
runtime: docker
plan: free
branch: main
dockerfilePath: ./Dockerfile
healthCheckPath: /health
autoDeployTrigger: checksPass
```

- `branch: main` means only the main branch is deployed.
- `autoDeployTrigger: checksPass` means Render waits for the GitHub Actions
  checks on that commit. If CI fails, Render does **not** deploy.
- Render injects `PORT`; the application already reads `process.env.PORT`.
- `NODE_ENV=production` is set in the Blueprint.

There are no application secrets in this project. If one is added later, put it
in Render's **Environment** settings, never in `render.yaml` or a committed
workflow file. `.env` is ignored by Git and by the Docker build.

### CI vs CD in this setup

| Concern | Component |
| --- | --- |
| lint, tests, build | GitHub Actions (CI) |
| decide whether the commit is deployable | GitHub Actions checks |
| build the Docker image for production | Render |
| run the public service | Render |
| health check | Render + `/health` |
| rollback | Render dashboard |

GitHub Actions does not hold a deployment credential. Render performs CD after
the CI checks pass. This is simpler and safer for a learning project than
storing a deploy hook in GitHub.

## Smoke test

After the first deploy, and after every later deploy:

```bash
bash scripts/smoke-test.sh https://<service>.onrender.com
```

Or manually:

```bash
curl -fsS https://<service>.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "service": "ci-cd-learning-api",
  "version": "1.0.0",
  "uptimeSeconds": 12,
  "timestamp": "2026-10-23T15:08:16.590Z"
}
```

The script waits up to 120 seconds because a sleeping free service can take
about a minute to wake up.

## Logs, failures and rollback

### Deployment logs

Render dashboard -> your service -> **Logs**. The build log shows Docker and
`npm ci`/`npm run build` output; the runtime log shows Nest logs and crashes.

Local equivalent:

```bash
podman logs -f ci-cd-learning-api-local
```

### If CI fails

- The pull request shows a red check.
- Render's `checksPass` trigger does not deploy the commit.
- Fix the code, push again, and wait for a green run.
- Never bypass a red check just to "see it deployed".

### If the build fails on Render

The previous working deploy keeps serving traffic. Read the build log, fix the
cause and push to `main` again. If the failure is in the Dockerfile or a
dependency, reproduce it locally first:

```bash
podman build -t ci-cd-learning-api:local .
```

### If the deployed app is unhealthy

Render uses `/health` as the health check. If the new instance never becomes
healthy, Render keeps the previous healthy instance in service.

### Rollback

Render dashboard -> your service -> **Deploys** -> select the previous working
deploy -> **Rollback**. On the free plan only the two most recent previous
deploys are available.

A second, Git-based rollback is to revert the bad commit:

```bash
git revert <bad-commit>
git push origin main
```

The revert goes through CI and then deploys like any other change, which keeps
the audit trail honest.

### Stage 11 exercise: prove that a broken build is not deployed

1. On a branch, break the build or a test.
2. Push and open a pull request. CI fails.
3. Confirm Render did not create a new deploy for that commit.
4. Fix it, push, wait for CI to pass.
5. Confirm Render deploys the fixed commit only.
6. Run the smoke test again.

## Git workflow

```bash
git init -b main
git add .
git commit -m "feat: implement tasks API with tests and CI"
```

Create an empty GitHub repository (no README, no `.gitignore`) and push:

```bash
git remote add origin git@github.com:<you>/ci-cd-learning-api.git
git push -u origin main
```

Feature branch and pull request:

```bash
git switch -c feature/improve-validation
# edit code
git add .
git commit -m "feat: reject blank task titles"
git push -u origin feature/improve-validation
gh pr create --fill
```

Read the diff, wait for a green CI run, then merge. Delete the branch after the
merge.

### Branch protection

On GitHub: **Settings** -> **Branches** -> **Add branch protection rule** (or
**Rulesets**). Require a pull request and require the CI status check before
merging. Availability differs by repository visibility and GitHub plan; enable
it where your account allows it.

### Merge conflicts

A conflict happens when two branches change the same lines. Git marks the file:

```text
<<<<<<< HEAD
current branch
=======
incoming branch
>>>>>>> other-branch
```

Choose the correct final content, remove the markers, run the tests, then:

```bash
git add <file>
git commit
```

## Learning stages checklist

- [x] **1. Scaffold** — NestJS, TypeScript, lerd custom container, tests, lint.
- [x] **2. API** — tasks module, DTO validation, status codes, `404`s.
- [x] **3. Tests** — unit tests for the service and e2e tests for HTTP.
- [ ] **4. Git** — local repository, `.gitignore` and commits are done; GitHub push, branch and PR are pending account access.
- [x] **5. CI** — `.github/workflows/ci.yml` runs lint, tests and build on push/PR.
- [ ] **6. Failure** — intentionally break a test, push, watch CI fail (needs the GitHub remote).
- [ ] **7. Fix** — repair the test, push, watch CI pass (needs the GitHub remote).
- [x] **8. Container** — `podman build`, `podman run`, `/health`, logs, stop.
- [ ] **9. CD** — Render Blueprint and `render.yaml` are ready; the deploy is pending a Render account.
- [ ] **10. Public test** — open the HTTPS URL and run the smoke test (pending deploy).
- [ ] **11. Broken deploy** — break the build/test, confirm Render does not deploy (pending deploy).
- [ ] **12. Operate** — README and rollback docs are done; live logs and rollback are pending deploy.

## Security notes

- Never commit `.env`, `.env.local`, tokens, deploy hooks or private keys.
- `.gitignore` already excludes environment files and `.lerd.local.yaml`.
- `.dockerignore` excludes environment files from the build context.
- The container runs as the unprivileged `node` user.
- The CI workflow has `contents: read` only.
- Deployment credentials, if ever added, belong in GitHub Actions secrets or
  the hosting provider's environment settings, never in YAML committed to Git.
- This API has no authentication by design. Do not put real or sensitive data
  in it.

## License

UNLICENSED — learning project.
