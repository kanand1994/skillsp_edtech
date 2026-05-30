#!/usr/bin/env bash
# Sets all required GitHub Actions secrets for the SkillSphere repo using the `gh` CLI.
#
# Prerequisites:
#   1. Install GitHub CLI:  https://cli.github.com/
#   2. Authenticate:        gh auth login
#   3. Clone the repo and `cd` into it.
#   4. Copy /app/scripts/.secrets.example → ./.secrets and fill in real values.
#   5. Run:                 ./scripts/setup-github-secrets.sh
#
# The script reads ./.secrets (a KEY=VALUE file, gitignored) and pushes each as a repo secret.
# It will NEVER print secret values to stdout.
set -euo pipefail

SECRETS_FILE="${1:-.secrets}"
REPO="${GITHUB_REPO:-}"   # optional: org/repo. Defaults to current dir.

if ! command -v gh >/dev/null 2>&1; then
    echo "Error: gh CLI not installed. https://cli.github.com/"
    exit 1
fi

if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: $SECRETS_FILE not found. Copy scripts/.secrets.example → .secrets and fill in values."
    exit 1
fi

REQUIRED=(
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_REGION
    ECR_REGISTRY
    EC2_HOST
    EC2_USER
    EC2_SSH_KEY
    PUBLIC_API_URL
    EMERGENT_LLM_KEY
    RESEND_API_KEY
    STRIPE_API_KEY
    JWT_SECRET
    SUPERADMIN_EMAIL
    SUPERADMIN_PASSWORD
    SUPERADMIN_SECRET
)

OPTIONAL=(
    SUPERADMIN_ROUTE
    SENDER_EMAIL
    GRAFANA_PASSWORD
)

# shellcheck disable=SC1090
set -a; source "$SECRETS_FILE"; set +a

echo "Pushing secrets to $(gh repo view ${REPO:-} --json nameWithOwner -q .nameWithOwner)..."
for name in "${REQUIRED[@]}" "${OPTIONAL[@]}"; do
    value="${!name:-}"
    if [ -z "$value" ]; then
        if [[ " ${REQUIRED[*]} " =~ " ${name} " ]]; then
            echo "  ✗ $name (MISSING — required)"; continue
        fi
        echo "  – $name (skipped, optional & empty)"; continue
    fi
    if [ -n "${REPO:-}" ]; then
        gh secret set "$name" --repo "$REPO" --body "$value" >/dev/null
    else
        gh secret set "$name" --body "$value" >/dev/null
    fi
    echo "  ✓ $name"
done

echo ""
echo "Done. List with: gh secret list ${REPO:+--repo $REPO}"
echo "Workflows that consume these: .github/workflows/{backend,frontend,docker,aws-deploy,security}.yml"
