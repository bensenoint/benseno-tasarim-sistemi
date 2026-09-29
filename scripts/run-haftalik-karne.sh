#!/bin/bash
# run-haftalik-karne.sh — Pazartesi 08:30 TR: haftalık karneleri üretir (scheduler'dan).
set -e
cd "$(dirname "$0")/.."
node scripts/haftalik-karne.js >> logs/haftalik-karne.log 2>&1
