# Hava81 — Rota Hava Durumu ve Hava Uyarıları, 9 Ekim 2026

**Geliştirme dalı:** `feat/route-alert-visual-from-main-20261009`
**Başlangıç:** `main` / `977d208` (PR #1286 birleştirildikten sonra).

## Değişiklik günlüğü — Önce → Sonra

1. **Rota başlığı:** Soluk, düz başlık → lacivert–turkuaz atmosfer gradyanı, büyük tipografi ve vurgulu sağ açma/kapatma düğmesi.
2. **Rota formu:** Yan yana gelişigüzel alanlar → kendi yüzeyi olan, yuvarlatılmış, hizalanmış bir rota giriş kartı.
3. **Yön değiştir:** Dar masaüstü düğmesinde metin kırılması → genişleyen tek satırlı masaüstü düğmesi; mobilde 44×44 px yuvarlak ikon.
4. **Rota puanı:** Düz, kenar çizgisiyle ayrılan sayı → açıkça belirgin ve yüksek kontrastlı puan kapsülü.
5. **Güzergâh bölümleri:** Aralarında yalnızca dik çizgiler bulunan beş sütun → ayrık, gölgeli, risk seviyesine göre üst sınırı renklendirilmiş beş kart.
6. **İyileştirilmiş zaman önerisi:** Düz vurgu şeridi → yuvarlatılmış ve çerçeveli karar kartı.
7. **Hava Uyarıları:** Düz bir yardımcı satır → açık mavi tonlu ve sol kenarı vurgulu bir yardımcı panel.
8. **Uyarı düğmesi:** Sade kenarlıklı düğme → daha belirgin, yuvarlatılmış ve odak durumu olan bir etkileşim alanı.
9. **Açık/koyu tema:** Her iki tasarım için ayrı kontrast düzenlemeleri.
10. **Erişilebilirlik / duyarlılık:** 1440, 768, 390 ve 320 px ekranlarda test; büyütülmüş metinle şehir seçicileri, klavye odağı ve rota kartı yatay kaydırması korundu.

Değişiklikler yalnızca CSS tasarım katmanında ve yeni tasarımın beklentilerini doğrulayan Playwright testlerinde. **Meteorolojik hesaplamalar, güzergâh algoritması, API cevapları ve bildirim izinleri değiştirilmedi.**

## Gerçek Chromium ile önce/sonra

Her görselin **sol tarafı önce**, **sağ tarafı sonra** sürümüdür. Önce görüntüleri canlı Hava81 sitesinden; sonra görüntüleri izole production-preview üzerinden alındı. İzmir veya İstanbul'a ilişkin hava değerleri ve zaman damgaları, gerçek servis yanıtlarının doğal değişkenliği nedeniyle aynı olmayabilir.

| Ekran | Rota formu | Hava Uyarıları |
|---|---|---|
| Masaüstü · açık | ![Masaüstü · açık rota önce ve sonra](desktop-light-route.webp) | ![Masaüstü · açık uyarı önce ve sonra](desktop-light-alerts.webp) |
| Tablet · açık | ![Tablet · açık rota önce ve sonra](tablet-light-route.webp) | ![Tablet · açık uyarı önce ve sonra](tablet-light-alerts.webp) |
| 390 px · açık | ![390 px · açık rota önce ve sonra](mobile-light-route.webp) | ![390 px · açık uyarı önce ve sonra](mobile-light-alerts.webp) |
| 390 px · koyu | ![390 px · koyu rota önce ve sonra](mobile-dark-route.webp) | ![390 px · koyu uyarı önce ve sonra](mobile-dark-alerts.webp) |
| 320 px · açık | ![320 px · açık rota önce ve sonra](compact-light-route.webp) | ![320 px · açık uyarı önce ve sonra](compact-light-alerts.webp) |

### Rota sonucu ve puan karşılaştırması

**Masaüstü:** ![Rota puanı ve beş koridor kartı önce/sonra](desktop-light-result.webp)

**Mobil:** ![Mobil rota puanı ve beş koridor kartı önce/sonra](mobile-light-result.webp)

Karşılaştırma panoları yanında ham ekran görüntüleri sunucuda `/home/ubuntu/Hava81-route-alert-main-20261009/test-results/route-alert/screens/` konumunda saklanır. JSON ölçümleri `report.json` dosyasında yer alır. Capture scripti: `scripts/capture-route-alert-visual.mjs`.

## Yerel kontroller

- TypeScript, ESLint ve production build: başarılı
- Playwright hedef testleri: mevcut görsel sözleşmelerin yeni düzenle karşılaştırılması; rota formu, 320px genişlik, %200 metin büyütme ve klavye odak kontrolü.
- 10/10 tam ekran/tema görsel yakalama: HTTP 200, yatay taşma ve tarayıcı JavaScript hatası yok.
- Uygun olduğunda gerçek API'den rota sonucu alınarak iki ekran varyantında sonuç kanıtı kaydedildi.
- Birim testi sonucu ayrıca PR kontrol listesinden doğrulanacaktır.

**Güvenlik:** Çalışma ayrı Git worktree'de yapıldı. `/home/ubuntu/Hava81-latest` dizinindeki commit edilmemiş üç dosyaya dokunulmadı. GitHub CI/CD ve CodeQL başarılı olmadan squash merge yapılmayacak.
