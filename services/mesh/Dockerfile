# syntax=docker/dockerfile:1
# The mesh is a broker worker — no exposed port.

FROM python:3.12-slim AS base
# Copy the uv binary from its official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Install dependencies against the lockfile first for layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY src/ src/
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
ENTRYPOINT ["python", "-m", "mesh.worker"]
