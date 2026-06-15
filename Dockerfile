# Benseno Tasarım Sistemi — Railway tek-servis container
# Slack bot (always-on) + node-cron scheduler aynı süreçte.
FROM node:22-bookworm-slim

# Sistem bağımlılıkları: git+curl (push & headless Slack/GitHub API), python3 (aylik script),
# tzdata (Europe/Istanbul), bash (run-*.sh), postgresql-client (pg_dump — DB yedeği).
# NOT: bookworm'un varsayılan postgresql-client'ı 15; sunucu 18 → "version mismatch". PGDG
# deposundan güncel client (>= sunucu) kurulur (pg_dump sunucudan yeni/eşit olmalı).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl python3 ca-certificates tzdata bash gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*

ENV TZ=Europe/Istanbul
ENV HOME=/root
# Container root olarak çalışıyor; claude-code --dangerously-skip-permissions'ı
# root'ta reddeder. İzole container = sandbox → belgelenmiş bypass.
ENV IS_SANDBOX=1

# Claude Code CLI (headless: claude -p, ANTHROPIC_API_KEY ile auth)
RUN npm install -g @anthropic-ai/claude-code

# Mac uyumluluğu: run-*.sh scriptleri /opt/homebrew/bin/claude bekliyor.
# Scriptleri DEĞİŞTİRMEMEK için (Mac soğuk-yedeği de aynı scriptleri kullanıyor)
# container'da bu yolu gerçek claude'a symlink'liyoruz.
RUN mkdir -p /opt/homebrew/bin \
 && ln -sf "$(command -v claude)" /opt/homebrew/bin/claude

# Proje dizini: scriptler ve bot $HOME/benseno-tasarim-sistemi varsayıyor
WORKDIR /root/benseno-tasarim-sistemi

# Önce bağımlılıklar (katman cache)
COPY package*.json ./
RUN npm install --omit=dev

# Kalan proje (.dockerignore gizli dosyaları ve gereksizleri hariç tutar; .git push için kalır)
COPY . .

RUN chmod +x scripts/*.sh

ENTRYPOINT ["bash", "scripts/railway-entrypoint.sh"]
