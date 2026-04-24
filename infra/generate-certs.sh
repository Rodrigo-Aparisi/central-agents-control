#!/usr/bin/env bash
# Generates a self-signed TLS certificate for intranet use.
# Usage: bash infra/generate-certs.sh [hostname]
# Outputs: infra/certs/server.crt + server.key

set -euo pipefail

HOST="${1:-cac.internal}"
CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -sha256 \
  -days 825 \
  -nodes \
  -subj "/CN=${HOST}/O=CAC/C=ES" \
  -addext "subjectAltName=DNS:${HOST},DNS:localhost,IP:127.0.0.1"

echo "Certificates written to $CERTS_DIR/"
echo "  server.crt  (share with browsers to trust)"
echo "  server.key  (keep private, never commit)"
echo ""
echo "To use TLS, set NGINX_CONF=nginx.conf in your .env before starting."
