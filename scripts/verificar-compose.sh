#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

suffix="$(date +%s)-$$"
backup_dir="$(mktemp -d)"
source=(docker compose --env-file .env.example -p "saldo-prueba-$suffix")
destination=(docker compose --env-file .env.example -p "saldo-recuperado-$suffix")
export WEB_PORT="${SALDO_TEST_PORT:-18080}"

cleanup() {
  local status=$?
  if (( status != 0 )); then
    "${source[@]}" logs --tail 30 >&2 || true
    "${destination[@]}" logs --tail 30 >&2 || true
  fi
  "${source[@]}" down -v >&2 || true
  "${destination[@]}" down -v >&2 || true
  rm -f "$backup_dir/saldo.dump" "$backup_dir/ids-originales"
  rmdir "$backup_dir"
}
trap cleanup EXIT

verify() {
  local mode=$1
  shift
  "$@" exec -T app node --input-type=module - "$mode" < scripts/verificar.mjs
}

printf '\n== Construcción y arranque ==\n'
docker version --format 'Docker cliente {{.Client.Version}}, motor {{.Server.Version}}'
docker compose version
"${source[@]}" up -d --build --wait --wait-timeout 120
"${source[@]}" ps
"${source[@]}" exec -T app node --version
"${source[@]}" exec -T db psql -U finanzas_admin -d finanzas -Atc 'SHOW server_version;'
verify cargar "${source[@]}"

printf '\n== Persistencia al recrear servicios ==\n'
"${source[@]}" ps -q > "$backup_dir/ids-originales"
"${source[@]}" down
"${source[@]}" up -d --wait --wait-timeout 120
test "$(cat "$backup_dir/ids-originales")" != "$("${source[@]}" ps -q)"
rm -f "$backup_dir/ids-originales"
verify verificar "${source[@]}"

printf '\n== Respaldo y recuperación en un volumen nuevo ==\n'
"${source[@]}" exec -T db pg_dump -U finanzas_admin -d finanzas -Fc -f /tmp/saldo.dump
"${source[@]}" cp db:/tmp/saldo.dump "$backup_dir/saldo.dump"
printf 'Tamaño del respaldo (bytes): '
wc -c < "$backup_dir/saldo.dump"
printf 'SHA-256: '
if command -v sha256sum >/dev/null; then
  sha256sum "$backup_dir/saldo.dump" | cut -d' ' -f1
else
  shasum -a 256 "$backup_dir/saldo.dump" | cut -d' ' -f1
fi
"${source[@]}" down

export WEB_PORT="${SALDO_RESTORE_PORT:-18081}"
"${destination[@]}" up -d --build --wait --wait-timeout 120
"${destination[@]}" ps
test "$("${destination[@]}" exec -T db psql -U finanzas_admin -d finanzas -Atc 'SELECT count(*) FROM public.movimientos;')" = 0
"${destination[@]}" cp "$backup_dir/saldo.dump" db:/tmp/saldo.dump

started=$(date +%s)
"${destination[@]}" exec -T db pg_restore -U finanzas_admin -d finanzas \
  --clean --if-exists --single-transaction --exit-on-error /tmp/saldo.dump
verify alta-recuperada "${destination[@]}"
printf 'Tiempo de restauración y verificación: %s s, resolución de un segundo.\n' "$(( $(date +%s) - started ))"
