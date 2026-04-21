#!/usr/bin/env bash
set -euo pipefail
PORT_VALUE="${PORT:-10000}"
WORKERS_VALUE="${WEB_CONCURRENCY:-2}"
THREADS_VALUE="${GUNICORN_THREADS:-4}"
TIMEOUT_VALUE="${GUNICORN_TIMEOUT:-120}"
exec gunicorn wsgi:app \
  --bind "0.0.0.0:${PORT_VALUE}" \
  --workers "${WORKERS_VALUE}" \
  --threads "${THREADS_VALUE}" \
  --timeout "${TIMEOUT_VALUE}" \
  --access-logfile - \
  --error-logfile -
