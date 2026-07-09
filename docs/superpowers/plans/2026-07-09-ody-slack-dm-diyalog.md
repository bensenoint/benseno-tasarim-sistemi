# Ody Slack DM Diyaloğu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline).

**Goal:** Ody'nin DM'ine yazılan mesajlar Ody beynine gitsin: okur, kaydeder, yetki dahilinde aksiyon alır, yanıtlar.

## Task 1: api.js — odyChatRun çıkarımı (davranış birebir) + /api/chat delegasyonu
## Task 2: migration 0018 — ody_chat_log.kanal
## Task 3: api.js — POST /api/ody-dm (writeGuard, DM geçmişi Map: son 10, 2h TTL)
## Task 4: slack-bot.js — im event → /api/ody-dm köprüsü (60s timeout, hata mesajı)
## Task 5: node --check ×2 + birim test + deploy api + bot push + Help satırı + dashboard deploy
