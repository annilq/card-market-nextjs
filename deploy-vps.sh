#!/usr/bin/env bash
# 本地触发 VPS 部署：通过 SSH 以 root 连接服务器，进入项目目录并执行服务端的 deploy.sh。
#
# 服务端 deploy.sh 位于 /srv/card-market/deploy.sh（根目录即 /srv/card-market），它会：
#   git pull --ff-only -> docker compose build -> up -d -> /api/health 健康检查
# 本机脚本只负责「连接 + 执行 + 透传结果」，不做构建，也不本地 push。
set -euo pipefail

# ---------- 可配置项（都可用环境变量覆盖）----------
SSH_TARGET="${SSH_TARGET:-root}"                          # ~/.ssh/config 中 root -> root@153.115.43.228（密钥认证）
REMOTE_DIR="${REMOTE_DIR:-/srv/card-market}"              # 服务器上项目根目录
REMOTE_DEPLOY="${REMOTE_DEPLOY:-$REMOTE_DIR/deploy.sh}"   # 服务端部署脚本路径

SSH_OPTS=(
  -o ConnectTimeout=10
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
)
# 本地是交互终端时给远程分配 TTY（docker build 进度更直观）；CI 下不分配，退出码更干净
if [ -t 0 ]; then
  SSH_OPTS+=(-t)
fi

DRY_RUN=0

usage() {
  cat <<'EOF'
用法: ./deploy-vps.sh [选项]

通过 SSH 以 root 连接 VPS，在 REMOTE_DIR 下执行服务端的 deploy.sh。

选项:
  -n, --dry-run    只打印将要执行的远程命令，不真正连接
  -h, --help       显示本帮助

环境变量:
  SSH_TARGET      SSH 目标，默认 root（~/.ssh/config 里指向 root@153.115.43.228）
  REMOTE_DIR      服务器项目目录，默认 /srv/card-market
  REMOTE_DEPLOY   服务端 deploy.sh 路径，默认 $REMOTE_DIR/deploy.sh

注意: 服务端 deploy.sh 第一步是 git pull，请先在本地 commit 并 push 到 main。
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -n|--dry-run) DRY_RUN=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "未知参数: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# 进到项目目录再执行：deploy.sh 内部有 cd "$(dirname "$0")"，用绝对路径同样安全
REMOTE_CMD="cd '$REMOTE_DIR' && bash '$REMOTE_DEPLOY'"

echo "==> 本地触发 VPS 部署"
echo "    SSH 目标 : $SSH_TARGET"
echo "    项目目录 : $REMOTE_DIR"
echo "    部署脚本 : $REMOTE_DEPLOY"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "    (dry-run) ssh ${SSH_OPTS[*]} $SSH_TARGET -- $REMOTE_CMD"
  exit 0
fi

# deploy.sh 会 git pull；本地若有未推送提交，提前提醒（只读比较，不 fetch、不 push）
if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
  unpushed="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
  if [ "$unpushed" -gt 0 ]; then
    echo "警告: 本地有 $unpushed 个提交尚未 push 到 origin/main；服务端 git pull 拉不到它们。" >&2
  fi
fi

echo "==> 连接 VPS 并执行部署（输出实时透传）..."
set +e
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$REMOTE_CMD"
rc=$?
set -e

if [ "$rc" -eq 0 ]; then
  echo "==> 部署脚本执行成功 (exit 0)"
else
  echo "==> 部署失败：SSH 或 deploy.sh 返回 $rc" >&2
  echo "    排查命令：ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose logs --tail=100 app'" >&2
fi
exit "$rc"
