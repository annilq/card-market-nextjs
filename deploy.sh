#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

prev_commit="$(git rev-parse HEAD)"
git pull --ff-only

if ! docker compose build; then
  echo "构建失败，旧容器未动。commit: $prev_commit" >&2
  exit 1
fi

docker compose up -d

ok=0
for _ in $(seq 1 30); do
  if docker compose exec -T app node -e 'require("http").get("http://127.0.0.1:3100/api/health",r=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))' >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo "健康检查未通过。容器已是新版本但未就绪。" >&2
  echo "先看日志：docker compose logs --tail=100 app" >&2
  echo "回滚：git checkout $prev_commit && docker compose build && docker compose up -d" >&2
  exit 1
fi

echo "部署完成 commit $(git rev-parse HEAD)，/api/health 返回 200"
