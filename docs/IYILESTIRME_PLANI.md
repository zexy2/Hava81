# Hava81: İyileştirme planı

İnceleme tarihi 21 Ekim 2026. Canlı site masaüstünde ve mobilde, açık ve koyu temada, TR ve EN dillerinde gezildi. Kod tarafında `main` dalı okundu; testler, build ve Lighthouse gerçekten çalıştırıldı.

> **Tasarım kararı (2026-10-21):** canlıdaki mavi premium görünüm esas alınır. DESIGN.md'deki teal "atlas" paletine geri dönülmez; düzeltmeler mavi görünüme uyacak şekilde yapılır. Faz 2'deki "Senin kararın gerekiyor" sorusu bu kararla kapanmıştır.

## Kısa teşhis

Teknik temel sağlam:
- Tip hatası ve lint hatası yok.
- 771 birim testinin hepsi geçiyor, kapsam %92.
- Lighthouse skorları 91–100 arasında.
- `npm audit` 0 açık gösteriyor.

Asıl sorunlar başka yerde:
1. **Kimlik kaybı.** DESIGN.md'deki "atlas" tasarımı, 14 adet üst üste "polish" CSS dosyası yüzünden canlıda geçersiz kalmış. Ortaya jenerik bir mavi cam dashboard çıkıyor. 37 CSS dosyasında 572 farklı hex renk var.
2. **Güven kaybı.** Aynı ekranda dört farklı "en iyi zaman", iki farklı koşul ("Açık" / "Sisli") ve üç farklı rüzgâr değeri gösteriliyor.
3. **Operasyonel risk.**
   - API dünyadaki her koordinatı kabul ediyor, bu da kotanın tüketilmesine açık kapı bırakıyor.
   - API elle deploy ediliyor.
   - Bir güvenlik PR'ı draft halinde bekliyor.

---

## Faz 0: Bu hafta, küçük ve acil işler (toplam ~1–2 gün)

- [x] **0.1** API'de lat/lon değerlerini Türkiye sınırlarıyla kısıtla, cache anahtarını 2 ondalık haneye yuvarla, upstream çağrıları için global limit koy — _Canlıda `lat=40.71&lon=-74` sorgusu New York verisi döndürüyor. Bir döngü kotayı bitirip bütün kullanıcıları veri alamaz hale getirebilir — S_
- [x] **0.2** fast-uri güvenlik PR'ını hazır yap, merge et, ardından API'yi deploy et — _CI'ı yeşil, çakışmasız ama draft halinde bekliyor — S_
- [x] **0.3** Açık temada favori şehir sekmelerinin kontrastını düzelt — _Kontrast 1,04–2,33:1, sekmeler okunmuyor — S_
- [x] **0.4** Açık temada "Bildirim engelli" butonunu görünür yap — _Beyaz zemin üstünde beyaz metin — S_
- [x] **0.5** Mobilde native scrollbar'ları kaldır — _Aralık seçicide yalnızca 13 px taşma için scrollbar çıkıyor ve "12s" kesiliyor — S_
- [x] **0.6** Odak halkası için tek bir token tanımla, koyu zeminde açık renk halka kullan — _Kontrast 1,8–2,1:1, WCAG eşiği 3:1 — S_
- [x] **0.7** Varsayılan temayı `auto` yap, dili `navigator.language` ile seç — _Koyu temalı telefonda uygulama açık temada açılıyor — S_

## Faz 1: Güven, tek bir doğruluk kaynağı (~3–5 gün)

Durum: tamamlandı (PR #1325)

- [x] **1.1** Tek bir "decision snapshot" seçici yaz: en iyi pencere, koşul, min/max ve rüzgâr tek yerden hesaplansın — _Aynı ekranda çelişen veriler var. Ürünün "5 saniyede karar" vaadini doğrudan bozuyor — M_
  - Kaldığı yer: `src/domain/decision/decisionSnapshot.ts` (`getDecisionSnapshot`) eklendi; Karar özeti (hero), Karar alanı ("…civarı daha sakin pencere") ve Gün planı artık aynı en iyi pencereyi okuyor; "benzer görünüyor" durumunda en uygun saat gösterilmiyor. Aktivite kartları bilinçli olarak aktiviteye özel pencere hesaplıyor (farklı eşikler); istenirse etiketleri "bu aktivite için" diye netleştirilebilir.
- [x] **1.2** "Şu an" için tek sağlayıcı kullan. Min/max değerlerinde "önümüzdeki 24 saat" ile "takvim günü" ayrımını etiketle — _OpenWeather ve Open-Meteo verisi uzlaştırılmadan yan yana basılıyor — M_
  - Kaldığı yer: "Şu an" için tek kaynak OpenWeather current; saatlik tahmindeki "Şimdi" kutusu artık ana kartla aynı sıcaklık/ikonu gösteriyor. Karar alanındaki aralık "Bugün (takvim günü) yüksek / düşük", saatlik özet "24 saatte en düşük/en yüksek" olarak etiketlendi. API değişikliği yok.
- [x] **1.3** Arama hatasında mevcut şehri koru, hatayı satır içinde göster, "Şunu mu demek istediniz?" önerisi sun — _Şu an tek bir yazım hatası bakılan şehri tamamen siliyor — M_
- [x] **1.4** Bütün sayı, tarih ve saat biçimlerini tek bir `format.ts` dosyasından `Intl` ile üret. Kopyayı bir kez editoryal olarak elden geçir — _TR'de "1.6 m/s", EN'de 4 farklı tarih biçimi, "Rüzgar/Rüzgâr" karışıklığı var. "1s" ifadesi "saniye" gibi okunuyor — S–M_
  - Kaldığı yer: `src/utils/format.ts` eklendi; Karşılaştır/Aktivite/Ulaşım rüzgârı, bağlam şeridi ve saat biçimleri buna taşındı; "Rüzgâr" ve "1sa" düzeltildi. Diğer bileşenlerdeki yerel `Intl` örnekleri zaten doğru ondalık üretiyor; Faz 3.3 bölünmesinde `format.ts`'e taşınabilir.
- [x] **1.5** Hata ve yükleme durumlarını sebebe göre ayır, varsa son bilinen veriyi göster — _"İnternetinizi kontrol edin" mesajı, sorun sunucuda olsa bile çıkıyor — S_
  - Kaldığı yer: Hata mesajları sebebe göre ayrıldı (çevrimdışı / sunucuya ulaşılamıyor / sunucu hatası 5xx / sağlayıcı 502-503-504). Altyapı hatasında ekranda veri yoksa yerel önbellekteki son bilinen veri "Son bilinen veri gösteriliyor (saat)" notuyla gösteriliyor. API değişikliği yok. Eksik: son bilinen veri yolu için ayrı birim testi yok.

## Faz 2: Tasarım kimliği, Awwwards'a giden yol (~2–3 hafta)

Durum: devam ediyor — dal feat/faz2-tasarim, PR https://github.com/zexy2/Hava81/pull/1326

> **Senin kararın gerekiyor:** Hangisi geçerli olacak?
> - **DESIGN.md:** teal, kâğıt zemin, serif rakam, düz yüzeyler.
> - **Canlıdaki mavi "premium" görünüm.**
>
> **Karar: canlıdaki mavi premium görünüm.** 2.2'deki "dev serif sıcaklık" mevcut mavi premium yazı karakteriyle dev sıcaklık olarak yorumlanır.

- [ ] **2.1** Tokenları tek bir `tokens.css` dosyasında topla (light/dark). 14 polish dosyasını bileşen CSS'lerine göm ve sil. CSS `@layer` kullan. Stylelint ile ham hex, izinsiz radius ve izinsiz breakpoint kullanımını yasakla — _L (kademeli)_
  - Kaldığı yer: başlanmadı (kredi). Önerilen ilk adım: `src/styles/PremiumDashboard.css:2-25`'teki mavi paleti `src/styles/tokens.css`'e taşı (light/dark), ardından App.tsx'teki polish importlarını tek tek bileşen CSS'lerine göm. Faz 2'de eklenen `FirstScreenComposition.css` de bu dosyaya katlanmalı.
- [x] **2.2** İlk ekranı tek bir kompozisyon olarak yeniden tasarla: şehir + plaka + dev serif sıcaklık + "sıradaki değişim" cümlesi + 24 saatlik grafik. Kart mozaiği olmasın — _M_
  - Kaldığı yer: Mavi premium görünüm korundu (serif yok). `WeatherDecisionField` artık ilk blok: şehir + plaka + dev sıcaklık + "sıradaki değişim" cümlesi (`src/domain/decision/nextChange.ts`, yağış başlıyor/diniyor veya ≥3° değişim) + 24 saatlik mini sıcaklık eğrisi. Masaüstünde yanında Ritim grafiği, Karar özeti altına iniyor. Stil: `src/styles/FirstScreenComposition.css`. Kontrol: 1280 açık ve 390 koyu ekran görüntüsü.
- [ ] **2.3** Bilgi mimarisini sadeleştir. Sayfada 10 modül ve 4 skor türü var. Ana akış Karar + Ritim + tek bir çevresel yüzey olsun. Çıkış planı, aktiviteler, bildirimler ve rota ikinci seviye bir "Planla" görünümüne taşınsın. Tek skor gösterilsin, saatlik skorlara etiket konsun — _L_
  - Kaldığı yer (kısmi): Ana akış artık Karar (ilk ekran + Karar özeti) + Ritim (tahmin) + tek çevresel yüzey (EnvironmentRail). Gün planı, ulaşım, aktiviteler, uyarılar, bağlam sinyalleri ve rota `src/App.tsx` içinde ayrı bir "Planla" bölümüne (`.atlas-plan-view`, stil `src/styles/FirstScreenComposition.css`) toplandı; `.atlas-dashboard > .x` seçicileri `.atlas-dashboard .x` oldu. **Sıradaki:** (1) Planla'yı alt gezintide ayrı görünüm yapmak (`AtlasBottomNav` 'plan' öğesi + `?view=plan`) — e2e'de bu panellere doğrudan bakan ~150 satır var, birlikte güncellenmeli; (2) tek skor: DecisionGlance 0–100 skoru dışındaki skorları (aktivite/saatlik) "bu aktivite için" diye etiketlemek.
- [x] **2.4** İlk ziyarette konum izni beklemeden İstanbul'u (ya da tahmini ili) hemen göster — _M_
  - Kaldığı yer: `src/App.tsx` — kök adreste geçmiş yoksa doğrudan İstanbul açılıyor (URL `/istanbul/`), konum izni istenmiyor; konum seçeneği başlıktaki konum düğmesinde. Engelleyici konum kapısı yalnızca geri tuşuyla köke dönüldüğünde görünür. Eski kapı testleri (birim + e2e) yeni davranışa göre güncellendi. Tahmini il (IP) yok: API desteği gerekirdi.
- [x] **2.5** Haritayı 81 ilin gerçek verisiyle bir "atlas" ekranına dönüştür. Bu, ürünün imza ekranı olabilir. Plaka işaretçisi sıcaklıkla karışmasın. Harita ve Karşılaştır için URL desteği ekle (`?view=map`) — _M_
  - Kaldığı yer: `src/components/WeatherMap.tsx/.css` — yakınlaştırma ≥7'de 81 ilin tamamı plaka işaretçisiyle görünüyor (varsayılanda 10 öne çıkan il); plaka işaretçisi artık beyaz plaka + mavi "TR" şeridi, yuvarlak renkli sıcaklık balonundan ayrışıyor. `src/App.tsx` — `?view=map` ve `?view=compare` açılışta ilgili görünümü açıyor ve görünüm değiştikçe URL güncelleniyor. **Eksik:** 81 ilin canlı sıcaklığı haritada yok; bunun için toplu uç nokta gerekir (Faz 3.2 `/weather/bundle`) — **API deploy gerekir**.
- [x] **2.6** 5 günlük tahmini 5 sütun ya da DESIGN.md'deki gibi günlük satırlar olarak göster. Şu an 4+1 düzeninde — _S_
  - Kaldığı yer: `src/styles/ForecastCalendarVisualPolish.css` — 48rem ve üstünde sabit 5 sütun, altında günlük satırlar; tek kalan günü yayan kural kaldırıldı.
- [x] **2.7** Bütün yazıları en az 12 px, eylem ve uyarı metinlerini en az 14 px yap. Şu an 9,6 px metinler var — _S_
  - Kaldığı yer: CSS'teki tüm 12 px altı `font-size` değerleri 0.75rem/12px'e, buton/eylem/uyarı seçicilerindeki 14 px altı değerler 0.875rem'e yükseltildi (14 dosya).

## Faz 3: Mühendislik temizliği (~1–2 hafta, Faz 2 ile paralel yürüyebilir)

- [ ] **3.1** API deploy'unu CI'a bağla: imajı GHCR'a pushla, Oracle'da blue/green script'ini otomatik tetikle, `/health` endpoint'inde revision doğrula — _M_
- [ ] **3.2** Veri katmanı: istek iptali (AbortController), `isLoading` yalnızca çekirdek veriye bağlansın, tek bir `/weather/bundle` uç noktası olsun. Şu an şehir başına 5 istek atılıyor, rate limit dakikada 60. TanStack Query değerlendirilebilir — _M–L_
- [ ] **3.3** `ForecastAtlas.tsx` tek fonksiyonda 1.373 satır; grafik, saatler, günler ve seçici olarak böl. `App.tsx` (960 satır) içinden routing, ikonlar ve iskelet bileşenlerini ayır — _M_
- [ ] **3.4** Kaynak dosyayı regex'le okuyan 32 test dosyasını gerçek DOM, `getComputedStyle` ya da görsel snapshot testine taşı. 6.615 satırlık smoke dosyasını böl. Coverage eşiğini %55'ten %85'e çek — _M_
  - Kaldığı yer (kısmi): smoke dosyası 3.x kapsamında bölündü (bkz. 3.x). Regex'le kaynak okuyan 32 birim test dosyası ve coverage eşiği henüz ele alınmadı.
- [ ] **3.5** Dependabot birikmesini temizle (9 PR): minor ve patch güncellemeleri otomatik merge edilsin, major'lar için ayda bir slot ayrılsın — _S–M_
- [ ] **3.6** CI'ı sadeleştir: ajan ve ops script testlerini ayrı bir workflow'a al, `push` tetikleyicisini yalnızca `main` ile sınırla. Kullanılmayan Docker Hub web imajı adımını kaldır. Kök compose'da `127.0.0.1:4000` kullan — _S_
- [ ] **3.7** Repoyu temizle: `docs/` içindeki 96 `AUTONOMOUS_*` logunu (yaklaşık 800 KB metin ve 11 MB PNG) dışarı taşı, 652 eski branch'i sil, README ve `.env.example` dosyalarını güncelle — _S_
- [ ] **3.8** Pages için CSP ve `immutable` cache başlıkları ekle (ya da web'i Oracle nginx'ten sun), API JSON yanıtlarına sıkıştırma aç — _S–M_

- [x] **3.x e2e sadeleştirme:** piksel testleri yerine davranış testleri + birkaç ekran görüntüsü karşılaştırması. Faz 2'de `test.fixme` yapılanlar:
  - `mid-width desktop decision reading reflows at 200 percent text size` (e2e/smoke.spec.ts) → `e2e/decision.spec.ts` içinde Faz 2 düzenine göre davranış testi olarak yeniden yazıldı, fixme kalktı.
  - Kaldığı yer: 6.434 satırlık `e2e/smoke.spec.ts` (148 test, ~316 piksel ölçen satır) konu dosyalarına bölündü: `app-shell`, `pwa`, `decision`, `forecast`, `plan`, `header-search`, `map-compare`, `settings`, `mobile-nav`, `a11y`, `reflow` (+ `visual`). Ortak mock/fixture ve davranış yardımcıları `e2e/helpers/` altında (`weather-fixtures.ts`, `test.ts`, `layout.ts`). `activity-card-resize`, `alerts-resize`, `loading-resize`, `route-result-resize`, `settings-resize` bu dosyalara katılıp silindi. Sonuç: smoke + 5 dosya ≈6.980 satır → yeni dosyalar + yardımcılar ≈3.020 satır; 154 test koşusu → 112 (+4 görsel); varsayılan liste 504 → 157 giriş (projeye özel testler artık `@mobile/@tablet/@desktop` etiketiyle tek projede listeleniyor, atlanan test için sayfa açılmıyor). Piksel/stil ölçümü (yarıçap, kenarlık, gölge, satır sayısı, yükseklik eşiği) yerine: görünür/viewport içinde, metin kırpılmıyor, yatay kaydırma yok, üst üste binme yok, işaretçiyle tıklanabilir, odak halkası görünür, 44 px hedef, açılır/kapanır, URL değişir. 12 "editorial yüzey" testi (salt stil) kaldırıldı; görünümü artık görsel karşılaştırmalar koruyor. Ayrıca `npm run lint` glob'u tırnaklandı (alt klasör eklenince yalnız `e2e/helpers` lint'leniyordu).
  - Görsel karşılaştırmalar (`e2e/visual.spec.ts`, `@visual`): ilk ekran 1280 açık, ilk ekran 390 koyu, Planla bölümü 1280, harita 390. Sabit saat + aynı ana bağlı fixture, yerel harita karoları, animasyon kapalı, `maxDiffPixelRatio: 0.01`. Varsayılan CI'da **çalışmaz**; yalnız `HAVA81_VISUAL=1` ile açılan `visual` projesinde koşar. Taban görüntüler repoda yok, CI Linux'ta üretilmeli: `HAVA81_VISUAL=1 npm run e2e -- --project=visual --update-snapshots` (ubuntu-latest, `npm ci` + `npx playwright install chromium` + `dist` sonrası), çıkan `e2e/visual.spec.ts-snapshots/*-visual-linux.png` dosyaları commit'lenir; sonra CI'a `HAVA81_VISUAL=1 npm run e2e -- --project=visual` adımı eklenebilir (workflow değişikliği bu PR'da yok).
  - Açık kalanlar: (1) yeni testlerin bulduğu, testte bilinçli olarak hariç tutulan küçük taşmalar — 320 px/%200'de "Önümüzdeki" sözcüğü (`.hava81-decision-field__next-change`) ~7 px, 320–360 px/%200'de "1sa…12sa" aralık düğmeleri birkaç px, 768 px/%200'de Karşılaştır'daki "FAVORITE CITIES" başlığı taşıyor (CSS'te `overflow-wrap: anywhere` ile çözülür); (2) dokunulmayan, hâlâ stil/kontrast hesaplayan dosyalar: `dashboard-visual-audit`, `decision-glance-scene-contrast`, `map-atmosphere-visual`, `mobile-320-keyboard`, `mobile-320-text-zoom`, `mobile-dock-contrast`, `mobile-landscape-dock`; (3) görsel tabanların CI'da üretilip commit'lenmesi.

## Faz 4: Büyüme ve SEO (sonra)

- [ ] İngilizce sürüm için `/en/<il>/` sayfaları ve `hreflang` etiketleri. Şu an İngilizce içerik indekslenemiyor.
- [ ] Build sırasında her il için statik bir özet render edilmesi ve il bazlı OG görseli. Şu an tek bir OG görseli var ve o da eski markayı taşıyor.
- [ ] Gerçek bir 404 sayfası: "Bu adreste bir il yok" mesajı ve benzer il önerileri.

---

## Önerilen sıra
1. **Faz 0:** hemen, tek PR serisiyle.
2. **Faz 1:** güven sorunu, kullanıcının en çok hissettiği şey.
3. **Tasarım kararı** (DESIGN.md mi, mavi mi), ardından **Faz 2**. Faz 3 paralel yürür.
4. **Faz 4.**

Kanıtlar ve ayrıntılar (dosya:satır, ölçümler, 64 ekran görüntüsü) UX ve kod raporlarında.
---

## Faz 0 notları (sahibin elle yapacağı adımlar)

### 0.1: uygulama notu
Yeni dosyalar: `apps/api/src/core/geo.ts` (Türkiye sınır kutusu: enlem 35.5–42.5, boylam 25.5–45; cache anahtarı 2 hane) ve `apps/api/src/core/upstream-budget.ts` (cache kaçıran tüm yüklemeler için süreç genelinde dakikalık limit, aşılırsa 503 `UPSTREAM_BUDGET_EXHAUSTED`). Limit `UPSTREAM_MAX_PER_MINUTE` ile ayarlanır (varsayılan 300). Testler: `apps/api/test/turkey-bounds.test.ts`. **Canlıya çıkması için aşağıdaki elle API deploy gerekir.**

### 0.2: fast-uri güvenlik PR'ı (#1320) — sahibin onayı gerekir
Ajan bu PR'ı merge etmez. Yapılacaklar:
1. https://github.com/zexy2/Hava81/pull/1320 sayfasında CI'ın yeşil olduğunu kontrol et.
2. **Ready for review** butonuna bas (ya da `gh pr ready 1320 --repo zexy2/Hava81`).
3. Merge et (`gh pr merge 1320 --repo zexy2/Hava81 --squash`).
4. Ardından aşağıdaki **API deploy adımlarını** uygula (fast-uri API bağımlılığıdır; canlıya ancak elle deploy ile çıkar).

### API'yi Oracle'a elle deploy etme (0.1 ve 0.2 için)
Kaynak: `deploy/oracle/README.md`. CI web sitesini yayınlar ama **API'yi deploy etmez**.
1. Oracle sunucusuna SSH ile bağlan, repo klasörüne geç (klasör yolu repoda yazılı değil; sunucudaki Hava81 checkout'u).
2. `git checkout main && git pull origin main` (merge edilmiş revizyon). `apps/api` altında commit'lenmemiş değişiklik olmamalı.
3. Önce plan: `sudo PLAN_ONLY=1 deploy/oracle/deploy-api-blue-green.sh`
4. Deploy: `sudo deploy/oracle/deploy-api-blue-green.sh` (boştaki slotu kurar, readiness kontrol eder, trafiği 4002'ye geçirir, eskiyi 4001'de geri dönüş için tutar).
5. Kontrol: `curl -s "https://api.hava81.zekiakgul.dev/api/weather/current?lat=40.71&lon=-74"` artık **400** dönmeli (0.1 deploy edildiyse); Türkiye koordinatı (`lat=41.01&lon=28.97`) normal veri dönmeli.
6. Sorun olursa: `sudo deploy/oracle/rollback-api.sh`

---

## Kaldığın yerden devam etme (yapay zekâ ajanı veya geliştirici için)

- **Dal:** `fix/faz0-hizli-duzeltmeler` — **PR:** "Faz 0: hızlı düzeltmeler" (draft, hedef `main`). Önce `git fetch && git checkout fix/faz0-hizli-duzeltmeler && git pull`.
- **Durum:** Bu dosyadaki işaretli kutular (`[x]`) tamamlanmış ve push'lanmış işlerdir. İlk boş kutudan devam et. Faz 0 sırası: 0.1, 0.3, 0.4, 0.5, 0.6, 0.7 (0.2 sahibin elle yapacağı iştir).
- **Kurulum ve testler (repo kökünden):**
  - `npm ci && npm --prefix apps/api ci`
  - Web birim testleri: `npm test` (tek dosya: `npx vitest run src/__tests__/...`)
  - Tip/lint: `npx tsc --noEmit` ve `npm run lint`
  - API testleri: `npm run api:test` ; API build: `npm run api:build`
  - Build: `npm run build`
- **Kural:** bir madde = bir commit. Maddenin kutusunu **aynı commit'te** `[x]` yap. Her commit'ten hemen sonra push'la; push'lanmamış iş bırakma.
- **Tasarım:** canlıdaki mavi premium görünüm esastır; teal'e dönme.
- **Merge ve deploy sahibin (Zeki/meryem) onayını gerektirir.** `main`'e doğrudan push yapma, PR'ı draft'tan çıkarma, deploy etme.
- Bir madde yapılamazsa kutuyu boş bırak ve altına nedenini not et.


## Deploy günlüğü

- **2026-10-21:** Faz 0 ve fast-uri API'ye deploy edildi; canlı API sürümü `9692181`. Kontrol: New York koordinatı 400, İstanbul 200.
  - Kullanılan temiz kopya: `/home/ubuntu/hava81-prod-20261021`. Eski `/home/ubuntu/Hava81` klasöründe commit'lenmemiş değişiklikler var ve `.git` izinleri bozuk, o klasörü kullanma.
  - `deploy/oracle/.env` repoda yok, sunucudaki kopyalardan alınıyor. Üç kopyası da aynı.
  - `/var/lock/hava81-api-operation.lock` dosyasının sahibi `chatgpt` kullanıcısı, bu yüzden root bile o dosyayı açamıyor. Geçici çözüm: `sudo HAVA81_API_OPERATION_LOCK=/var/lib/hava81/api-operation.lock deploy/oracle/deploy-api-blue-green.sh`. Kalıcı çözüm: `sudo rm /var/lock/hava81-api-operation.lock` (çalışan bir deploy yokken).
  - Sunucudaki Docker sürümü `publish=127.0.0.1:4002` filtresini kabul etmiyor. Bu PR'da filtre `publish=4002` olarak düzeltildi.
  - API yolları `/api/v1/...` altında, örnek: `/api/v1/weather/current?lat=41.01&lon=28.98`.
  - Sunucuda eski ajanlardan kalma yüzlerce Hava81 kopyası var (`/home/ubuntu`, `/home/chatgpt`, `/tmp`). Temizlik yapılması gerekiyor.
