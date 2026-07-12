#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  python3 launch_network.py
elif command -v python >/dev/null 2>&1; then
  python launch_network.py
else
  echo "Nu am gasit Python 3. Instaleaza doar Python 3 si ruleaza din nou."
  exit 1
fi
