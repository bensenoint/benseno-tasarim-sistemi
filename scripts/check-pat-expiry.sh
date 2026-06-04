#!/bin/zsh
# PAT Token Expiry Check — Her sabah 08:00'de çalışır
# 30 gün kala Slack DM atar, 7 gün kala her gün atar, expire olmuşsa kritik uyarı.

cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

# Doğrudan Slack DM (claude/notification-agent yerine — Railway-uyumlu, $LOG çağrı anında set).
GORKEM="U030C48PL23"
notify() {
  local tok=$(cat data/.slack-bot-token 2>/dev/null | tr -d '[:space:]')
  [ -z "$tok" ] && return 0
  local body=$(python3 -c "import json,sys; print(json.dumps({'channel':'$GORKEM','text':sys.argv[1],'unfurl_links':False}))" "$1")
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $tok" -H "content-type: application/json" --data "$body" >> "$LOG" 2>&1
}

PAT_FILE="data/.github-pat-sistem"
CREATED_FILE="data/.github-pat-created"
LOG="logs/pat-check.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# PAT dosyası yoksa çıkış (HTTP kontrolü için zorunlu). CREATED opsiyonel: container'da
# .github-pat-created olmayabilir (gitignored) → sayım atlanır ama HTTP kontrolü YİNE çalışır.
[[ ! -f "$PAT_FILE" ]] && echo "[$TIMESTAMP] PAT dosyası bulunamadı." >> "$LOG" && exit 1

PAT=$(cat "$PAT_FILE" | tr -d '[:space:]')
# Oluşturma tarihi: önce env (Railway: BENSENO_PAT_CREATED=YYYY-MM-DD), yoksa dosya
CREATED="${BENSENO_PAT_CREATED:-}"
[[ -z "$CREATED" && -f "$CREATED_FILE" ]] && CREATED=$(cat "$CREATED_FILE" | tr -d '[:space:]')

# GitHub API üzerinden PAT'in gerçekte geçerli olup olmadığını kontrol et
# HTTP 000 = ağ bağlantı hatası → 3 kez retry yap, ardından ağ hatası olarak işaretle
MAX_RETRY=3
HTTP_STATUS="000"
for i in 1 2 3; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "Authorization: token $PAT" \
    https://api.github.com/user)
  [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "401" || "$HTTP_STATUS" == "403" ]] && break
  # 000 veya 5xx = geçici hata, bekleyip tekrar dene
  echo "[$TIMESTAMP] Deneme $i/3: HTTP $HTTP_STATUS — 5 saniye bekleniyor..." >> "$LOG"
  sleep 5
done

if [[ "$HTTP_STATUS" == "000" ]]; then
  # Ağ ulaşılamadı — PAT geçersizliğinden farklı, alarm gönderme
  echo "[$TIMESTAMP] UYARI: GitHub API'ye ulaşılamadı (HTTP 000 — ağ hatası). PAT durumu bilinmiyor, DM gönderilmedi." >> "$LOG"
  exit 0
elif [[ "$HTTP_STATUS" != "200" ]]; then
  MSG="🚨 *GitHub PAT GEÇERSİZ!* (HTTP $HTTP_STATUS)\nBrief Sync ve GitHub push çalışmıyor. PAT'i hemen yenile: https://github.com/settings/tokens"
  echo "[$TIMESTAMP] KRITIK: PAT geçersiz (HTTP $HTTP_STATUS)" >> "$LOG"
  notify "$MSG"
  exit 1
fi

# Oluşturma tarihi yoksa: HTTP kontrolü zaten geçti (PAT geçerli) → sayımı atla, temiz çık.
if [[ -z "$CREATED" ]]; then
  echo "[$TIMESTAMP] PAT geçerli (HTTP 200). Oluşturma tarihi yok (BENSENO_PAT_CREATED set değil) → gün sayımı atlandı." >> "$LOG"
  exit 0
fi

# Oluşturma tarihinden expire tahmin (GitHub fine-grained PAT max 1 yıl)
# .github-pat-created formatı: YYYY-MM-DD
CREATED_EPOCH=$(date -d "$CREATED" "+%s" 2>/dev/null || date -j -f "%Y-%m-%d" "$CREATED" "+%s" 2>/dev/null)
if [[ -z "$CREATED_EPOCH" ]]; then
  echo "[$TIMESTAMP] Tarih parse hatası: $CREATED" >> "$LOG"
  exit 1
fi

# Expire = created + 365 gün (GitHub default 1 yıl)
EXPIRE_EPOCH=$(( CREATED_EPOCH + 365 * 86400 ))
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRE_EPOCH - NOW_EPOCH) / 86400 ))
EXPIRE_DATE=$(date -d "@$EXPIRE_EPOCH" "+%d %B %Y" 2>/dev/null || date -j -f "%s" "$EXPIRE_EPOCH" "+%d %B %Y" 2>/dev/null)

echo "[$TIMESTAMP] PAT geçerli. Tahmini expire: $EXPIRE_DATE ($DAYS_LEFT gün kaldı)" >> "$LOG"

# Uyarı eşikleri
if [[ $DAYS_LEFT -le 0 ]]; then
  MSG="🚨 *GitHub PAT BUGÜN EXPIRE OLDU!* Brief Sync durdu. Hemen yenile: https://github.com/settings/tokens"
  SEND=1
elif [[ $DAYS_LEFT -le 7 ]]; then
  MSG="⚠️ *GitHub PAT $DAYS_LEFT gün içinde expire oluyor!* ($EXPIRE_DATE) Hemen yenile: https://github.com/settings/tokens"
  SEND=1
elif [[ $DAYS_LEFT -le 30 ]]; then
  MSG="ℹ️ GitHub PAT *$DAYS_LEFT gün sonra* expire oluyor ($EXPIRE_DATE). Yenilemeyi planla: https://github.com/settings/tokens"
  SEND=1
else
  SEND=0
fi

if [[ $SEND -eq 1 ]]; then
  echo "[$TIMESTAMP] Slack uyarısı gönderiliyor: $DAYS_LEFT gün kaldı" >> "$LOG"
  notify "$MSG"
fi
