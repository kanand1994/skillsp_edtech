#!/usr/bin/env bash
# Install all SkillSphere-supported language runtimes in the running Piston container.
# Idempotent — safe to run multiple times.
#
# Prereqs: `docker compose up -d piston` has been started (waits 10s for container readiness).
set -euo pipefail

CONTAINER="${1:-skl-piston}"

# Wait until the container is healthy (it can take ~30s on first start to download base packages)
echo "Waiting for $CONTAINER..."
for i in {1..30}; do
    if docker exec "$CONTAINER" sh -c "curl -fsS http://localhost:2000/api/v2/runtimes >/dev/null 2>&1"; then
        echo "$CONTAINER is up"
        break
    fi
    sleep 2
done

LANGS=(
    "python 3.10.0"
    "node 18.15.0"
    "typescript 5.0.3"
    "java 15.0.2"
    "c++ 10.2.0"
    "c 10.2.0"
    "go 1.16.2"
    "rust 1.68.2"
    "ruby 3.0.1"
)

for lang_ver in "${LANGS[@]}"; do
    echo "→ installing: $lang_ver"
    docker exec "$CONTAINER" cli/index.js ppman install $lang_ver || true
done

echo ""
echo "Done. Verify with:"
echo "  curl http://localhost:2000/api/v2/runtimes | jq"
echo ""
echo "Then re-probe the backend so it picks up the new runtimes:"
echo "  curl -X GET http://localhost/api/coding/_probe"
