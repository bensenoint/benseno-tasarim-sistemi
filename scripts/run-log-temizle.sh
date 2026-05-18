#!/bin/zsh
# Log temizleme — Her Pazar çalışır (launchd ile)
# 30 günden eski log satırlarını temizler, dosya boyutunu kontrol altında tutar.

LOG_DIR=~/benseno-tasarim-sistemi/logs
MAX_LINES=5000  # Her log dosyasında tutulacak max satır

for logfile in "$LOG_DIR"/*.log; do
    [[ -f "$logfile" ]] || continue
    LINES=$(wc -l < "$logfile")
    if [[ "$LINES" -gt "$MAX_LINES" ]]; then
        # Son MAX_LINES satırı tut
        tail -n "$MAX_LINES" "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $logfile: $LINES → $MAX_LINES satır (trim)" >> "$LOG_DIR/log-temizle.log"
    fi
done
