#!/bin/bash
# wait-for-couchbase.sh

# set -e

CB_HOST="${CB_HOST:-db}"
CB_USER="${CB_USER:-Administrator}"
CB_PSWD="${CB_PSWD:-password}"

URL=http://${CB_HOST}:8091/pools/default/buckets/travel-sample/scopes/

echo "wait-for-couchbase: checking $URL"

out=/tmp/pools.output
while true; do
  status=$(curl -s -w "%{http_code}" -o $out -u "${CB_USER}:${CB_PSWD}" $URL)
  if [ "x$status" = "x200" ]; then
    echo "wait-for-couchbase: polling for expected scopes"
    hasScopes=$(jq '.scopes | map(.name) | contains(["inventory", "tenant_agent_00", "tenant_agent_01"])' < $out)
    if [ "x$hasScopes" = "xtrue" ]; then
      break
    fi
  fi
  sleep 2
done
echo "wait-for-couchbase: travel-sample scopes ready"

exec $@

