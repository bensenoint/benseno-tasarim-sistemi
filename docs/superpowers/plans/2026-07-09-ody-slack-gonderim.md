# Ody → Slack Gönderim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ody sohbetten Slack'e mesaj gönderebilsin: thread (atanan/açan/yönetici) + DM/kanal (yönetici) — sunucu-garantili önizleme+onay, imza, saatlik limit.

**Architecture:** ody-tools.js'e 2 araç (`slack_gonder` önizleme+kod üretir, `slack_gonder_onayla` gönderir) + bekleyen-gönderi haritası (uid→tek kayıt, TTL 10dk, reqSeq'li). api.js /api/chat kullanıcı başına istek sayacı (reqSeq) üretip ctx'e koyar — onay yalnız SONRAKİ istekte geçerli (aynı-tur bypass imkânsız). Gönderim server-local `server/slack.js` ile (postThread/dm + channelForBrand). Sistem yönergesine kullanım kuralı.

**Tech Stack:** server/ody-tools.js, server/api.js, server/slack.js (mevcut).

---

## Task 1: ody-tools.js — araçlar + bekleyen/limit altyapısı

- Modül üstüne: `const slack = require('./slack');` + `_gonderBekleyen = new Map()` (uid→{mod,hedefAd,kanal,ts?,uid2?,mesaj,kod,reqSeq,ts0}) + `_gonderSayac = new Map()` (uid→ts[]; 10/saat).
- Yardımcılar: `_isMgr(ctx)` = ctx.isAdmin || ed.bns_users kişi.rol==='yonetici'; `_imza(ctx, mesaj)` = `🤖 Ody — {ad} adına:\n{mesaj}`.
- `defs.slack_gonder`: input `{mod, hedef, mesaj}` (mesaj≤600). Çözümleme ed'den: thread→no ile brief (slack_channel+slack_ts şart) + yetki (workers/leads/created_by/uid ∈ veya mgr); dm→kişi (ad kısmi veya U-id, yalnız mgr); kanal→marka adı→`slack.channelForBrand` (yalnız mgr). Limit kontrolü burada. Başarıda: kod=6 haneli rasgele, Map'e yaz (reqSeq=ctx.reqSeq), dön `{onay_gerekli:true, onay_kodu, onizleme, not:'Kullanıcıya önizlemeyi göster; AÇIK onay almadan onaylama aracını ÇAĞIRMA.'}`.
- `defs.slack_gonder_onayla`: input `{onay_kodu}`. Kontroller: kayıt var + kod eşit + TTL<10dk + **ctx.reqSeq > kayıt.reqSeq** (değilse `{hata:'onay, önizlemeden SONRAKİ kullanıcı mesajında verilmeli'}`). Geçerse gönder (mod'a göre postThread/dm/kanal-postThread'siz chat), Map'ten sil, sayaç ekle, log `[ody-gonder]`, dön `{gonderildi:true, nereye}`.
- Test için: `process.env.ODY_GONDER_TEST==='1'` iken gerçek gönderim atlanır, `{test:true,...}` döner.

## Task 2: api.js — reqSeq + sistem yönergesi

- Modül: `const chatSeq = new Map();` /api/chat başında `const reqSeq=(chatSeq.get(uid)||0)+1; chatSeq.set(uid,reqSeq);` → `ctx = {..., reqSeq}`.
- Sistem yönergesine (slack_sorgu paragrafının ardına): "Kullanıcı Slack'e mesaj göndermeni AÇIKÇA isterse slack_gonder'ı çağır, dönen önizlemeyi kullanıcıya aynen göster ve onay iste; kullanıcı 'evet/gönder' gibi AÇIK onay verdikten sonra slack_gonder_onayla'yı çağır. Onay almadan onaylama aracını asla çağırma; kullanıcı istemeden gönderim teklif etme."

## Task 3: Birim testler (sahte ctx, ODY_GONDER_TEST=1)

Node inline: yetki matrisi (düz kullanıcı kendi thread ✓ / başkası ✗ / dm ✗; mgr dm ✓) · aynı reqSeq onay ✗ / reqSeq+1 ✓ · yanlış kod ✗ · limit (11.'de ✗).

## Task 4: Deploy + canlı smoke + doküman

- `node --check` ×2 · deploy api · Görkem'e canlı test DM (runTool ile, kendine) · Help Ody bölümüne satır ("📤 Slack'e mesaj: 'Ody, #85 thread'ine yaz: …' → önizleme → onayınla gönderir; thread'e atanan/açan/yönetici, DM/kanal yalnız yönetici; Ody imzasıyla gider") · dashboard build+deploy.

## Self-Review
Spec kapsama: 2 araç ✓ · reqSeq garantisi ✓ · yetki matrisi ✓ · imza/limit/log/TTL/tek-bekleyen ✓ · sistem yönergesi ✓ · gelecek-proaktif-DM kapsam dışı notu spec'te ✓. server-local (dashboard bağımlılığı yok) ✓.
