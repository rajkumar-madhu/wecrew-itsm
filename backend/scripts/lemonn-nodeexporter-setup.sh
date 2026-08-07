#!/bin/bash
# Deploy node-exporter on Lemonn Mumbai server
#
# Usage (run from the Prometheus/management host):
#   ssh -p 4422 user@154.210.170.126 'bash -s' < lemonn-nodeexporter-setup.sh
#
# Or copy to the remote server and run directly:
#   scp -P 4422 lemonn-nodeexporter-setup.sh user@154.210.170.126:/tmp/
#   ssh -p 4422 user@154.210.170.126 'bash /tmp/lemonn-nodeexporter-setup.sh'

set -euo pipefail

echo "[lemonn-nodeexporter-setup] Starting node-exporter deployment..."

# Check if already running
if docker ps --format '{{.Names}}' | grep -q '^node-exporter$'; then
  echo "[lemonn-nodeexporter-setup] node-exporter already running — restarting to ensure latest config..."
  docker rm -f node-exporter
fi

docker run -d \
  --name node-exporter \
  --restart unless-stopped \
  --net host \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/rootfs:ro \
  prom/node-exporter:latest \
  --path.procfs=/host/proc \
  --path.sysfs=/host/sys \
  --collector.filesystem.ignored-mount-points="^/(sys|proc|dev|host|etc)($|/)"

echo "[lemonn-nodeexporter-setup] node-exporter running on :9100"
echo ""
echo "Verify with: curl -s http://localhost:9100/metrics | head -20"
echo ""
echo "IMPORTANT: Ensure port 9100 is open in the firewall for Prometheus scraping:"
echo "  iptables -A INPUT -p tcp --dport 9100 -s <prometheus-host-ip> -j ACCEPT"
echo "  # OR if using ufw:"
echo "  ufw allow from <prometheus-host-ip> to any port 9100"
