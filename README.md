# Agent Altyapı Şablonu

A reusable Claude Code workflow template with role-specific agent definitions,
installation helpers, a validation script, and a reference task. This is tooling
and configuration, not an application or a benchmarked claim of agent quality.
Review the configuration before applying it to your own project.

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
install.ps1 / install.sh   # projeye kur/güncelle (hiçbir şeyi ezmeden)
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

## Kurulum ve güncelleme

Elle kopyalama yapma — install script'i kullan. Elle `cp` mevcut projenin
`CLAUDE.md`'sini siler; script silmez.

```powershell
# Windows
.\install.ps1 -Target C:\code\projem
```

```bash
# macOS / Linux
./install.sh /path/to/projem
```

Script hiçbir şeyi ezmez:

- **Mevcut `CLAUDE.md` korunur.** Ekip kuralları, script'in sahiplendiği
  işaretli bir bloğa yazılır. Güncellemede sadece o blok yeniden yazılır;
  senin yazdığın her şey ve **Project context** bölümün olduğu gibi kalır.
- **Mevcut `settings.json` korunur.** Şablonunki yanına
  `settings.json.from-template` olarak bırakılır, birleştirmesi sana kalır.
- **Elle düzenlediğin ajan dosyaları korunur.** Script kurduğu her dosyanın
  hash'ini `.claude/.template-manifest`'e yazar; sonraki çalıştırmada
  dokunulmamış dosyaları günceller, senin değiştirdiklerini bırakır ve
  hangilerini bıraktığını söyler. `-Force` / `--force` ile üzerine yazarsın.

Aynı komutu tekrar çalıştırmak = güncelleme. Kurulu sürüm
`.claude/TEMPLATE_VERSION` içinde durur, böylece hangi projenin hangi şablon
sürümünü taşıdığı belli olur.

Kurulumdan sonra `CLAUDE.md`'deki **Project context** bölümünü doldur (stack,
test/lint/build komutları) — worker'lar "testleri koş" derken neyi
kastettiğini oradan öğrenir. Ardından projenin kökünde `claude` başlat.

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
