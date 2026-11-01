#!/bin/sh
# Restarts arutha_lk when /api/health does not answer three times in a row (a hung or overloaded server: nginx
# returns 502 but systemd sees a running process). Run as root by arutha_lk_watchdog.timer every 2 minutes.
# Install: /usr/local/bin/arutha_lk_watchdog (scripts/deploy.sh). Log: journalctl -t arutha_lk_watchdog
URL=http://127.0.0.1:3000/api/health
systemctl is-active -q arutha_lk || exit 0 # stopped on purpose, or restarting
for i in 1 2 3; do
  curl -fsS -m 10 -o /dev/null "$URL" && exit 0
  sleep 5
done
logger -t arutha_lk_watchdog "no answer from $URL three times: restarting arutha_lk"
systemctl restart arutha_lk
