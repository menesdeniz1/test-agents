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
    ├── debugger.md        # hata kök nedeni bulur (opus)
    ├── test-writer.md     # test yazar           (sonnet)
    └── docs-writer.md     # dökümante eder       (sonnet)
CLAUDE.md                  # ekip çalışma kuralları (her oturumda otomatik yüklenir)
```

## Nasıl çalışır

1. **Sen orkestracıyla (ana oturum) konuşursun** — fikri anlatırsın, birlikte
   netleştirirsiniz. Ayrı bir "orkestracı ajanı" yoktur; ana oturumun kendisi
   orkestracıdır.
2. Karar netleşince orkestracı işi parçalara böler ve worker'lara **sırayla**
   dağıtır: kod → review → fix → test → döküman. Her worker bir öncekinin
   çıktısını görür (tutarlılık için varsayılan bu; paralellik yalnız sen hız
   istersen ve işler tamamen ayrık dosyalardaysa kullanılır).
3. Orkestracı, worker "bitti" dese bile commit'ten önce testleri kendisi
   bir kez daha koşar.

## Yeni projeye kurulum

```bash
# Yöntem 1 — bu repodan başla
git clone <bu-repo> yeni-projem && cd yeni-projem
# (istersen git geçmişini sıfırla: rm -rf .git && git init)

# Yöntem 2 — mevcut projeye ekle
cp -r .claude/ CLAUDE.md /path/to/mevcut-proje/
```

Sonra projenin kökünde `claude` başlat ve konuşmaya başla — kurulum bu kadar.

## Model / güç yönetimi

| Katman | Ne | Nereden ayarlanır |
|---|---|---|
| Orkestracı | Oturumun canlı modeli | `/model` komutu (ör. `/model opus`, `/model claude-fable-5`) — `settings.json`'daki `"model"` sadece yeni oturumların varsayılanı |
| Orkestracı gücü | Düşünme derinliği | `/effort max` (oturum içi) veya `claude --effort max` (başlatırken) |
| Worker'lar | Ajan başına model | İlgili `.claude/agents/*.md` dosyasındaki `model:` satırı (`sonnet`, `opus`, `haiku`, `inherit`) |

Katman mantığı: zeka **karar verilen** yere konur, talimat izlenen yere değil.
Yargı işleri (review, debug) opus'ta; sıkı spec'le çalışan uygulama işleri
(kod, test, döküman) sonnet'te. Orkestracıya en iyi modeli ver — kötü görev
bölümlemesini hiçbir akıllı worker telafi edemez.

## Kadro büyütme

Yeni rol dosyası ekleme; ihtiyaç anında orkestracıdan iste ("güvenlik
denetçisi ekle" gibi) — 30 saniyede oluşturur. Daha önce yazılıp bilinçli
olarak çıkarılan roller (security-reviewer, devops-engineer,
performance-optimizer, dependency-manager, researcher, refactorer) git
geçmişinde duruyor. Paralel kapasite gerektiğinde aynı worker'ın birden çok
kopyası dağıtılır, yeni rol açılmaz.
