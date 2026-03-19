#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PID_DIR="$PROJECT_DIR/.pids"

mkdir -p "$PID_DIR"

stop_all() {
  echo "正在停止服务..."
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  已停止 PID $pid"
    fi
    rm -f "$pidfile"
  done
  echo "全部已停止。"
}

status_all() {
  echo "服务状态："
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $name: 运行中 (PID $pid)"
    else
      echo "  $name: 已停止"
      rm -f "$pidfile"
    fi
  done
  [ ! "$(ls -A "$PID_DIR" 2>/dev/null)" ] && echo "  无运行中的服务"
}

start_all() {
  # 先停掉旧的
  stop_all 2>/dev/null || true

  echo "========== 启动后端 =========="
  if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv "$BACKEND_DIR/venv"
  fi
  "$BACKEND_DIR/venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

  nohup bash -c "cd '$BACKEND_DIR' && '$BACKEND_DIR/venv/bin/python' -m uvicorn main:app --host 0.0.0.0 --port 8066" \
    > "$PROJECT_DIR/backend.log" 2>&1 &
  echo $! > "$PID_DIR/backend.pid"
  echo "  后端已启动 (PID $!) → http://0.0.0.0:8066"
  echo "  日志: tail -f $PROJECT_DIR/backend.log"

  echo "========== 启动前端 =========="
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "安装前端依赖..."
    (cd "$FRONTEND_DIR" && npm install --silent)
  fi

  nohup npm run dev --prefix "$FRONTEND_DIR" \
    > "$PROJECT_DIR/frontend.log" 2>&1 &
  echo $! > "$PID_DIR/frontend.pid"
  echo "  前端已启动 (PID $!) → http://localhost:5173"
  echo "  日志: tail -f $PROJECT_DIR/frontend.log"

  echo ""
  echo "✅ 全部启动完成。使用 '$0 stop' 停止，'$0 status' 查看状态。"
}

case "${1:-start}" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; start_all ;;
  status)  status_all ;;
  *)
    echo "用法: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
