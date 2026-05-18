#!/bin/zsh
# ============================================================
# Benseno Tasarım Sistemi — Claude Code Kurulum Script'i
# Çalıştır: cd ~/benseno-tasarim-sistemi && zsh setup.sh
# ============================================================

set -e  # Hata olursa dur

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

ok()   { echo "${GREEN}✅ $1${RESET}"; }
warn() { echo "${YELLOW}⚠️  $1${RESET}"; }
err()  { echo "${RED}❌ $1${RESET}"; }
hdr()  { echo "\n${BOLD}━━━ $1 ━━━${RESET}"; }

PROJ=~/benseno-tasarim-sistemi

echo "${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Benseno Tasarım Sistemi — Claude Code Kurulum     ║"
echo "║   v7.13 · $(date '+%d %b %Y')                             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "${RESET}"

# ─── AŞAMA 1: Homebrew ───────────────────────────────────────
hdr "Aşama 1: Homebrew"

if ! command -v brew &>/dev/null; then
    warn "Homebrew bulunamadı. Yükleniyor..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon için PATH
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi
    ok "Homebrew kuruldu"
else
    ok "Homebrew mevcut: $(brew --version | head -1)"
fi

# ─── AŞAMA 2: Node.js ────────────────────────────────────────
hdr "Aşama 2: Node.js"

if ! command -v node &>/dev/null; then
    warn "Node.js bulunamadı. Yükleniyor..."
    brew install node
    ok "Node.js kuruldu"
else
    ok "Node.js mevcut: $(node --version)"
fi

# ─── AŞAMA 3: Claude Code CLI ────────────────────────────────
hdr "Aşama 3: Claude Code CLI"

if ! command -v claude &>/dev/null; then
    warn "Claude Code CLI bulunamadı. Yükleniyor..."
    npm install -g @anthropic-ai/claude-code
    ok "Claude Code CLI kuruldu"
else
    ok "Claude Code CLI mevcut: $(claude --version 2>/dev/null || echo 'versiyon alınamadı')"
fi

# ─── AŞAMA 4: Script izinleri ────────────────────────────────
hdr "Aşama 4: Script İzinleri"

chmod +x "$PROJ/scripts/"*.sh
ok "Tüm script'ler çalıştırılabilir yapıldı"

# ─── AŞAMA 5: Logs klasörü ───────────────────────────────────
hdr "Aşama 5: Log Klasörü"

mkdir -p "$PROJ/logs"
ok "logs/ klasörü hazır"

# ─── AŞAMA 6: launchd Job'ları ───────────────────────────────
hdr "Aşama 6: launchd Job'ları"

LAUNCH_AGENTS=~/Library/LaunchAgents
PLISTS=(
    "com.benseno.brief-sync"
    "com.benseno.sabah-raporu"
    "com.benseno.haftalik-retro"
    "com.benseno.aylik-strateji"
    "com.benseno.log-temizle"
)

for label in "${PLISTS[@]}"; do
    src="$PROJ/launchd/${label}.plist"
    dst="$LAUNCH_AGENTS/${label}.plist"

    if [[ ! -f "$src" ]]; then
        err "Plist bulunamadı: $src"
        continue
    fi

    # Mevcut job'ı unload et (hata vermesine izin ver)
    launchctl unload "$dst" 2>/dev/null || true

    # Kopyala ve load et
    cp "$src" "$dst"
    launchctl load "$dst"
    ok "$label aktif edildi"
done

# ─── AŞAMA 7: Doğrulama ──────────────────────────────────────
hdr "Aşama 7: Doğrulama"

echo "Aktif launchd job'lar:"
launchctl list | grep benseno || warn "Hiç benseno job'ı bulunamadı!"

# ─── AŞAMA 8: MCP Hatırlatma ─────────────────────────────────
hdr "Aşama 8: MCP Kurulum (Manuel Adımlar)"

echo ""
echo "${BOLD}Aşağıdaki adımları manuel tamamlamanız gerekiyor:${RESET}"
echo ""
echo "${YELLOW}1. Slack MCP kurulumu (SLACK_BOT_TOKEN gerekli):${RESET}"
echo "   claude mcp add slack --transport stdio --command npx --args '-y' '@modelcontextprotocol/server-slack'"
echo "   echo 'export SLACK_BOT_TOKEN=xoxb-...' >> ~/.zshrc"
echo "   echo 'export SLACK_TEAM_ID=T4Y3R6RAN' >> ~/.zshrc"
echo "   source ~/.zshrc"
echo ""
echo "${YELLOW}2. Google Workspace MCP (OAuth gerekli):${RESET}"
echo "   claude mcp add google --transport stdio --command npx --args '-y' '@modelcontextprotocol/server-google-workspace'"
echo "   claude mcp authenticate google"
echo ""
echo "${YELLOW}3. Claude Code'a login:${RESET}"
echo "   claude  # İlk çalıştırmada /login yapmanız istenir"
echo ""
echo "${YELLOW}4. Eksik data dosyaları (varsa oluşturun):${RESET}"
echo "   data/.github-pat           — GitHub Personal Access Token"
echo "   data/.github-pat-created   — Token oluşturma tarihi (ISO: 2026-05-18)"
echo "   data/.dashboard-auth-hash  — Dashboard şifresinin SHA-256 hash'i"
echo ""

# ─── AŞAMA 9: Test Komutları ─────────────────────────────────
hdr "Kurulum Tamamlandı — Test Komutları"

echo ""
echo "${GREEN}${BOLD}Kurulum başarıyla tamamlandı!${RESET}"
echo ""
echo "Sistemi test etmek için (MCP kurulduktan sonra):"
echo ""
echo "  ${BOLD}# MCP bağlantı testi${RESET}"
echo "  claude -p \"Canvas F0B1B6XUD44'ü oku, başlığını söyle\""
echo ""
echo "  ${BOLD}# Brief Sync dry-run${RESET}"
echo "  claude -p \"Skill: benseno-brief-sync — dry run, sadece ne yapacağını söyle\""
echo ""
echo "  ${BOLD}# Canlı log izleme${RESET}"
echo "  tail -f $PROJ/logs/brief-sync.log"
echo ""
echo "  ${BOLD}# Job durumları${RESET}"
echo "  launchctl list | grep benseno"
echo ""
echo "  ${BOLD}# Manual brief sync tetikleme${RESET}"
echo "  claude -p \"Skill: benseno-brief-sync — run now\""
echo ""
echo "${YELLOW}⚠️  ÖNEMLİ: MCP kurulumunu tamamlamadan sistem çalışmaz!${RESET}"
echo "${YELLOW}⚠️  ÖNEMLİ: Cowork'teki scheduled task'ları sadece 24 saat paralel test sonrası kapatın!${RESET}"
echo ""
