# Bugfix Requirements Document

## Introduction

The `acbu-backend` documentation (`README.md`) and environment template (`.env.example`) instruct users to configure service connection URLs using `localhost` as the hostname. This works correctly when the backend runs natively on the host machine, but breaks when the backend itself is run as a Docker container alongside the infrastructure services defined in `docker-compose.yml`.

Inside a Docker container, `localhost` resolves to the container itself, not the host machine or sibling containers. The correct hostname for container-to-container communication is the Docker Compose **service name** (e.g., `postgres`, `mongodb`, `rabbitmq`) as defined in `docker-compose.yml`. The documentation currently provides no guidance on this distinction, causing silent or hard-to-diagnose connection failures for users who run the full stack via Docker Compose.

The fix is limited to documentation and the `.env.example` file. No application code changes are required.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user follows the README setup instructions and sets `DATABASE_URL=postgresql://acbu_user:acbu_pass@localhost:5432/acbu_db` in their `.env` file, THEN the system fails to connect to PostgreSQL when the backend runs inside a Docker container, because `localhost` resolves to the backend container itself rather than the `postgres` service container.

1.2 WHEN a user sets `MONGODB_URI=mongodb://localhost:27017/acbu_db` in their `.env` file, THEN the system fails to connect to MongoDB when the backend runs inside a Docker container, because `localhost` does not resolve to the `mongodb` service container.

1.3 WHEN a user sets `RABBITMQ_URL=amqp://guest:guest@localhost:5672` in their `.env` file, THEN the system fails to connect to RabbitMQ when the backend runs inside a Docker container, because `localhost` does not resolve to the `rabbitmq` service container.

1.4 WHEN a user reads the README's "Docker Services" or setup sections, THEN the documentation provides no distinction between native local development URLs and Docker Compose container URLs, leaving users without a copy-paste-ready `.env` configuration for running the full stack via Docker Compose.

1.5 WHEN a user copies `.env.example` to `.env` without modification, THEN the example file contains only `localhost`-based URLs with no documented Docker Compose alternative, causing connection failures without a clear explanation of the cause.

### Expected Behavior (Correct)

2.1 WHEN a user runs the backend natively (`pnpm dev`) and the infrastructure services via Docker Compose, THEN the documentation SHALL instruct them to use `localhost` hostnames (e.g., `DATABASE_URL=postgresql://acbu:acbu_password@localhost:5432/acbu_db`), matching the host-exposed ports declared in `docker-compose.yml`.

2.2 WHEN a user runs the full stack via Docker Compose (backend container + infrastructure containers), THEN the documentation SHALL instruct them to use Docker Compose service names as hostnames (e.g., `DATABASE_URL=postgresql://acbu:acbu_password@postgres:5432/acbu_db`), where `postgres`, `mongodb`, and `rabbitmq` match the service names defined in `docker-compose.yml`.

2.3 WHEN a user reads the README's setup or Docker sections, THEN the documentation SHALL clearly present two distinct `.env` configuration blocks — one for native local development and one for full Docker Compose deployment — with copy-paste-ready values for each scenario.

2.4 WHEN a user opens `.env.example`, THEN the file SHALL include commented-out Docker Compose variants for `DATABASE_URL`, `MONGODB_URI`, and `RABBITMQ_URL`, with an inline note that hostnames must match the service names in `docker-compose.yml`.

2.5 WHEN the README presents Docker Compose service hostnames, THEN the documentation SHALL include a note that the service names (`postgres`, `mongodb`, `rabbitmq`) are derived from `docker-compose.yml` and must be updated if those service names are changed.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user follows the native local development setup (`pnpm dev` with services exposed on host ports), THEN the system SHALL CONTINUE TO connect successfully using `localhost`-based URLs for all services.

3.2 WHEN a user runs `pnpm prisma:migrate` against a direct `DATABASE_URL`, THEN the system SHALL CONTINUE TO apply migrations correctly without interference from this documentation change.

3.3 WHEN a user reads the README's existing sections (Technology Stack, Available Scripts, Project Structure, API Documentation, Testing, CI/CD, Health Check Endpoints), THEN those sections SHALL CONTINUE TO remain accurate and unaltered by this fix.

3.4 WHEN a user uses the `PRISMA_ACCELERATE_URL` for production runtime queries, THEN the existing Database URL Matrix documentation and its rules SHALL CONTINUE TO apply unchanged.

3.5 WHEN a user runs only the infrastructure services via Docker Compose (`docker-compose up -d rabbitmq`), THEN the existing README guidance for that partial-stack workflow SHALL CONTINUE TO be preserved and remain valid.
