#!/usr/bin/env bash
# Configura graphify en ESTE clon del repo. Correr una vez por clon.
#
# Los hooks de git viven versionados en .githooks/, pero git no los usa
# hasta que cada clon apunta core.hooksPath ahi: eso no se versiona, por
# eso hace falta este script.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify no esta en el PATH."
  echo "  uv tool install graphifyy && uv tool update-shell"
  echo "  (despues abri una terminal nueva)"
  exit 1
fi

# 1. Hooks versionados: post-commit y post-checkout regeneran el grafo.
git config core.hooksPath .githooks
echo "core.hooksPath -> .githooks"

# 2. Merge driver: sin esto cada merge de graphify-out/graph.json es un
#    conflicto a mano. .gitattributes ya lo declara; el driver es por clon.
git config merge.graphify.name "graphify graph.json union merge"
git config merge.graphify.driver "graphify merge-driver %O %A %B"
echo "merge driver graphify -> registrado"

# 3. Grafo inicial si no existe.
if [ ! -f graphify-out/graph.json ]; then
  echo "generando grafo inicial..."
  graphify extract . --code-only
  graphify cluster-only . --no-label
fi

echo
echo "Listo. El grafo se regenera solo en cada commit."
echo "Manual: graphify update .    |    Desactivar temporalmente: GRAPHIFY_SKIP_HOOK=1"
