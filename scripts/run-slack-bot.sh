#!/bin/zsh
# Benseno Slack Bot — launchd tarafından başlatılır, çöküncee otomatik restart edilir.

cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# launchd ortamında ağ geç başlayabilir — 5sn bekle
sleep 5
source ~/.zshrc 2>/dev/null

# Token'ları .zshrc'den veya ortam değişkenlerinden al
# Eğer .zshrc'de tanımlıysa source sonrası gelir, yoksa aşağıdan oku
if [[ -z "$SLACK_APP_TOKEN" ]] && [[ -f data/.slack-app-token ]]; then
  export SLACK_APP_TOKEN=$(cat data/.slack-app-token)
fi

if [[ -z "$SLACK_BOT_TOKEN" ]] && [[ -f data/.slack-bot-token ]]; then
  export SLACK_BOT_TOKEN=$(cat data/.slack-bot-token)
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Slack Bot başlatılıyor..." >> logs/slack-bot.log

/opt/homebrew/bin/node scripts/slack-bot.js < /dev/null >> logs/slack-bot.log 2>&1
