# Agent Altyapı Şablonu

Claude Code için hazır **orkestracı + worker** ajan altyapısı. Bu repoyu
klonlayıp içinde yeni bir proje geliştirebilir, ya da `.claude/` klasörü ile
`CLAUDE.md` dosyasını mevcut bir projenin köküne kopyalayarak aynı sistemi
oraya taşıyabilirsin. Proje kodu içermez — sadece ekip mantığı.

## İçerik

```
.claude/
├── settings.json          # varsayılan model/effort + workflow ayarları
└── agents/
    ├── feature-builder.md # kod yazar            (sonnet)
    ├── code-reviewer.md   # kodu inceler         (opus)
    ├── debugger.md        # düzeltir: review bulguları + hata kök nedeni (opus)
    ├── test-writer.md     # test yazar           (sonnet)
    └── docs-writer.md     # dökümante eder       (sonnet)
CLAUDE.md                  # ekip çalışma kuralları (her oturumda otomatik yüklenir)
golden-task/               # şablonu ölçmek için sabit referans görev
scripts/validate-agents.js # ajan dosyalarının biçim kontrolü
.github/workflows/         # bu kontrolü her push'ta koşan CI
```

## Nasıl çalışır

1. **Sen orkestracıyla (ana oturum) konuşursun** — fikri anlatırsın, birlikte
   netleştirirsiniz. Ayrı bir "orkestracı ajanı" yoktur; ana oturumun kendisi
   orkestracıdır.
2. Karar netleşince orkestracı işi parçalara böler ve worker'lara **sırayla**
   dağıtır: kod → review → fix → test → döküman. Paralellik yalnız sen hız
   istersen ve işler tamamen ayrık dosyalardaysa kullanılır.
3. Orkestracı, worker "bitti" dese bile commit'ten önce testleri kendisi
   bir kez daha koşar.

Pipeline'da bilinmesi gereken iki kural:

- **Worker'lar birbirini görmez.** Her subagent boş bir context ile başlar;
  önceki raporu bir sonrakinin spec'ine koymak orkestracının işidir.
- **`code-reviewer` düzeltmez.** Bilinçli olarak Edit/Write araçları yok;
  bulgularını orkestracı `debugger`'a fix spec'i olarak devreder.

Her worker cevabını sabit dört başlıkla bitirir — **Changed / Verified /
Assumptions / Open** — böylece zincirleme mekanik olarak yapılabilir.
Ayrıntılar `CLAUDE.md`'de.

## Yeni projeye kurulum

```bash
# Yöntem 1 — bu repodan başla
git clone <bu-repo> yeni-projem && cd yeni-projem
# (istersen git geçmişini sıfırla: rm -rf .git && git init)

# Yöntem 2 — mevcut projeye ekle
cp -r .claude/ CLAUDE.md /path/to/mevcut-proje/
```

Sonra `CLAUDE.md`'deki **Project context** bölümünü doldur (stack, test/lint/
build komutları) — worker'lar "testleri koş" derken neyi kastettiğini oradan
öğrenir. Ardından projenin kökünde `claude` başlat.

## Model / güç yönetimi

| Katman | Ne | Nereden ayarlanır |
|---|---|---|
| Orkestracı | Oturumun canlı modeli | `/model` komutu (ör. `/model opus`) — `settings.json`'daki `"model"` sadece yeni oturumların varsayılanı |
| Orkestracı gücü | Düşünme derinliği | Kalıcı ayar `settings.json` → `"effortLevel"` (`low`/`medium`/`high`/`xhigh`); oturum içi `/effort` |
| Worker'lar | Ajan başına model | İlgili `.claude/agents/*.md` dosyasındaki `model:` satırı (`sonnet`, `opus`, `haiku`, `inherit`) |

Katman mantığı: zeka **karar verilen** yere konur, talimat izlenen yere değil.
Yargı işleri (review, fix) opus'ta; sıkı spec'le çalışan uygulama işleri
(kod, test, döküman) sonnet'te. Orkestracıya en iyi modeli ver — kötü görev
bölümlemesini hiçbir akıllı worker telafi edemez. Varsayılan bu yüzden
opus'tur.

## Şablonu geliştirme

Bu reponun ürünü prompt'lar, dolayısıyla bir ajan tanımını değiştirdiğinde
"daha iyi mi oldu?" sorusunun ölçülebilir bir cevabı olmalı. `golden-task/`
bunun için: içine iki kasıtlı tuzak gömülmüş, sabit sözlü bir referans görev
ve onu puanlayan bir rubrik. Şablonu her değiştirdiğinde koş, sonucu
`golden-task/RESULTS.md`'ye şablonun git SHA'sıyla birlikte yaz.

CI (`scripts/validate-agents.js`) sadece ajan dosyalarının *biçimini*
doğrular — iyi olduklarını değil. Ölçüm kısmı golden task'ın işi.

## Kadro büyütme

Yeni rol dosyası ekleme; ihtiyaç anında orkestracıdan iste ("güvenlik
denetçisi ekle" gibi) — 30 saniyede oluşturur. Daha önce yazılıp bilinçli
olarak çıkarılan roller (security-reviewer, devops-engineer,
performance-optimizer, dependency-manager, researcher, refactorer) git
geçmişinde duruyor. Paralel kapasite gerektiğinde aynı worker'ın birden çok
kopyası dağıtılır, yeni rol açılmaz.
