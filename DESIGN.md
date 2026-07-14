---
name: Hava81
description: Türkiye'nin 81 ili için karar odaklı meteorolojik atlas.
colors:
  atlas-field: '#F3F6F4'
  atlas-paper: '#FFFFFF'
  atlas-ink: '#142524'
  atlas-muted: '#5C6C6A'
  atlas-line: '#C8D6D2'
  aegean-main: '#146B73'
  aegean-deep: '#0F555C'
  aegean-pale: '#A8C9C5'
  saffron-signal: '#E7A531'
  vermilion-alert: '#D6543D'
  night-atlas: '#0E2C32'
typography:
  display:
    fontFamily: 'Source Serif 4, Georgia, serif'
    fontSize: '7.5rem'
    fontWeight: 300
    lineHeight: 0.88
    letterSpacing: '-0.045em'
    fontFeature: 'tnum, lnum, kern'
  headline:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '2rem'
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 'normal'
  data:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.01em'
    fontFeature: 'tnum, lnum'
  button:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.01em'
  label:
    fontFamily: 'IBM Plex Sans, Helvetica Neue, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.1em'
rounded:
  xs: '2px'
  sm: '4px'
  md: '8px'
  lg: '12px'
spacing:
  2xs: '4px'
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  2xl: '48px'
  3xl: '64px'
  4xl: '96px'
components:
  button-primary:
    backgroundColor: '{colors.aegean-main}'
    textColor: '{colors.atlas-paper}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '12px 20px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.aegean-deep}'
    textColor: '{colors.atlas-paper}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '12px 20px'
    height: '44px'
  button-secondary:
    backgroundColor: '{colors.atlas-field}'
    textColor: '{colors.atlas-ink}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '12px 20px'
    height: '44px'
  field-search:
    backgroundColor: '{colors.atlas-paper}'
    textColor: '{colors.atlas-ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
    height: '48px'
  atlas-surface:
    backgroundColor: '{colors.atlas-paper}'
    textColor: '{colors.atlas-ink}'
    rounded: '{rounded.md}'
    padding: '24px'
  city-tab-active:
    backgroundColor: '{colors.night-atlas}'
    textColor: '{colors.atlas-paper}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
    height: '40px'
  signal-warning:
    backgroundColor: '{colors.saffron-signal}'
    textColor: '{colors.atlas-ink}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
---

# Design System: Hava81

## 1. Overview

**Creative North Star: "Türkiye'nin Meteorolojik Atlası"**

Hava81, Türkiye yol ve meteoroloji atlaslarının ölçülü bilgi düzenini çağdaş bir ürün arayüzüne taşır. Genel his sakin, hassas ve yereldir: geniş bir atlas alanı, derin mürekkep tipografisi, ince koordinat çizgileri ve yalnızca anlam taşıdığında görünen meteorolojik sinyaller.

Sistem tek bir baskın “bugün” yüzeyi etrafında kurulur. Şehir, mevcut koşul ve sıradaki önemli değişim ilk bakışta okunur; tahmin, çevresel ölçümler ve harita aynı veri hikâyesinin daha derin katmanlarıdır. Arayüz sıradan mavi-mor hava durumu şablonlarını, dekoratif cam kartları ve eşit ağırlıklı dashboard mozaiklerini açıkça reddeder.

**Key Characteristics:**

- Atlas hassasiyetinde asimetrik ancak öngörülebilir ürün grid'i.
- Bir ana karar yüzeyi, az sayıda gerçek yardımcı yüzey.
- Teal etkileşim, safran yaklaşan değişim, vermilion kritik uyarı anlamına gelir.
- Büyük meteorolojik rakamda kontrollü serif; diğer tüm UI'da teknik ve okunaklı sans.
- Topoğrafik çizgi, koordinat ve plaka kodu ayrıntıları düşük dozda markasal imza oluşturur.
- Mobil ilk viewport şehir, mevcut koşul ve sıradaki değişimi birlikte gösterir.

## 2. Colors

Palet serin atlas kâğıdı ve koyu mürekkep üzerinde, Ege teal'ini ana etkileşim rengi; safran ve vermilionu ise seyrek meteorolojik sinyaller olarak kullanır.

### Primary

- **Ege İstasyon Teali** (`#146B73`): Birincil eylemler, aktif seçimler, odak halkaları ve veri üzerindeki geçerli konum.
- **Derin Ege Teali** (`#0F555C`): Primary hover/active durumları ve küçük alanlardaki yüksek kontrastlı etkileşim.
- **Soluk Ege Katmanı** (`#A8C9C5`): Seçili zaman aralıkları, hafif grafik dolguları ve etkileşim yüzeyi tonu.

### Secondary

- **Safran Değişim Sinyali** (`#E7A531`): Yaklaşan yağış, sıcaklık kırılması veya dikkat gerektiren fakat kritik olmayan değişim. Üzerindeki metin her zaman Atlas Mürekkebi'dir.
- **Vermilion Uyarı Sinyali** (`#D6543D`): Yalnızca kritik veya hata durumları; metin rengi olarak değil ikon, tam çevre çizgisi ve sınırlı yüzey tonu olarak kullanılır.

### Neutral

- **Atlas Alanı** (`#F3F6F4`): Ana uygulama zemini.
- **İstasyon Kâğıdı** (`#FFFFFF`): Girdi, dialog ve gerektiğinde yükseltilen gerçek yüzey.
- **Atlas Mürekkebi** (`#142524`): Birincil metin ve safran üzerindeki metin.
- **Sessiz Koordinat** (`#5C6C6A`): İkincil metin; Atlas Alanı üzerinde normal metinde 4.5:1 üzeri kontrast sağlar.
- **Harita Çizgisi** (`#C8D6D2`): Ayırıcı, kontur ve pasif sınır.
- **Gece Atlası** (`#0E2C32`): Koyu tema zemini ve aktif şehir bağlamı.

### Named Rules

**The Meteorological Signal Rule.** Ege Teali etkileşimi, Safran yaklaşan değişimi, Vermilion yalnızca kritik uyarıyı anlatır; bu renkler dekorasyon için yer değiştirmez.

**The Paper Majority Rule.** Her ekranın büyük çoğunluğu Atlas Alanı, İstasyon Kâğıdı ve Atlas Mürekkebi ile kurulur; sinyal renkleri nadir oldukları için güçlüdür.

## 3. Typography

**Display Font:** Source Serif 4 Variable (Georgia fallback)

**Body Font:** IBM Plex Sans Variable (Helvetica Neue fallback)

**Character:** Source Serif 4, yalnızca ana meteorolojik rakama basılı atlas ciddiyeti ve insani bir ritim verir. IBM Plex Sans bütün navigasyon, veri, etiket ve açıklamalarda teknik ama soğuk olmayan bir netlik sağlar.

### Hierarchy

- **Display** (300, masaüstü `7.5rem`, mobil `4.5rem`, `0.88`): Yalnızca mevcut ana sıcaklık; lining ve tabular rakamlar kullanır.
- **Headline** (600, `2rem`, `1.1`): Şehir veya ekran başlığı; aynı viewport'ta en fazla bir kez.
- **Title** (600, `1.25rem`, `1.25`): Tahmin ve çevresel bölüm başlıkları.
- **Data** (500, `1.125rem`, `1.2`): Saatlik sıcaklık, rüzgâr ve sayısal metrikler; tabular rakamlar kullanır.
- **Body** (400, `1rem`, `1.55`): Karar cümlesi, açıklama, hata ve yardım metni; uzun satırlar en fazla `65ch`.
- **Button** (600, `0.875rem`, `1.2`): Kontrol metni; cümle düzeninde yazılır.
- **Label** (600, `0.75rem`, `0.1em`): Kısa koordinat, zaman ve atlas üst etiketleri; uppercase yalnızca bu rolde.

### Named Rules

**The One Serif Moment Rule.** Serif yalnızca ana sıcaklık rakamında görünür; şehir, küçük sıcaklıklar, tahmin, harita ve kontroller IBM Plex Sans kalır.

**The Five-Second Rule.** Tipografi şehir, mevcut sıcaklık, koşul ve sıradaki değişimi beş saniye içinde taranabilir kılmıyorsa hiyerarşi yeniden kurulmalıdır.

## 4. Elevation

Sistem varsayılan olarak düzdür. Derinlik; bulanıklık veya dekoratif gölge yerine Atlas Alanı ile İstasyon Kâğıdı arasındaki ton farkı, `1px` Harita Çizgisi ve cömert bölüm boşluklarıyla kurulur. Gölge yalnızca dialog, açılan arama sonucu ve mobil sheet gibi gerçekten üst katmana çıkan yüzeylerde kullanılır.

### Shadow Vocabulary

- **Overlay Ambient** (`0 16px 48px rgba(14, 44, 50, 0.16)`): Yalnızca dialog, arama listesi ve modal sheet.

### Named Rules

**The Flat Atlas Rule.** Dinlenme durumundaki içerik yüzeyleri gölgesizdir; yükselti yalnızca etkileşim veya üst katman ilişkisi olduğunda görünür.

## 5. Components

### Buttons

- **Shape:** Hassas ve kompakt, `4px` radius; pill formu yok. Görsel ölçüden bağımsız olarak minimum hedef `44×44px`.
- **Primary:** Ege İstasyon Teali zemin, İstasyon Kâğıdı metin, `12px 20px` padding.
- **Hover / Focus:** Hover'da Derin Ege Teali; focus-visible'da `2px` Ege Teali halka ve `2px` offset. Active geri bildirimi `100–150ms` içinde `translateY(1px)` ile verilir.
- **Secondary / Ghost:** Atlas Alanı veya şeffaf zemin, Atlas Mürekkebi metin, `1px` Harita Çizgisi.

### Chips

- **Style:** Şehir ve filtre seçimleri `4px` radius'lu küçük atlas sekmeleridir; dekoratif pill değildir.
- **State:** Aktif şehir Gece Atlası üzerinde beyaz; pasif şehir şeffaf zeminde Atlas Mürekkebi ve ince tam çevre çizgisi kullanır.

### Cards / Containers

- **Corner Style:** Gerçek yüzeylerde `8px`, büyük sheet ve dialoglarda en fazla `12px`.
- **Background:** Ana zemin Atlas Alanı; gerçek yardımcı yüzey İstasyon Kâğıdı.
- **Shadow Strategy:** Dinlenmede gölge yok; yalnızca Overlay Ambient üst katmanlarda.
- **Border:** `1px` Harita Çizgisi; renkli kalın yan şerit yok.
- **Internal Padding:** Kompakt yüzeyde `16px`, standart yüzeyde `24px`, ana karar yüzeyinde `24–32px`.

### Inputs / Fields

- **Style:** `48px` yükseklik, `4px` radius, İstasyon Kâğıdı zemin, görünür label ve Atlas Mürekkebi metin.
- **Focus:** `2px` Ege Teali halka, `2px` offset; placeholder normal gövde metninin yerine geçmez.
- **Error / Disabled:** Hata tam çevre Vermilion çizgisi, hata ikonu ve açıklayıcı metinle birlikte gösterilir; disabled yalnızca opaklığa dayanmaz.

### Navigation

Masaüstünde Hava81 kimliği, şehir arama ve ayarlar tek kompakt üst rayda bulunur. Mobilde ilk viewport'u kaplamayan sticky şehir/arama başlığı ve Bugün, Harita, Kayıtlı için üç öğeli alt navigasyon kullanılır. Aktif durum renk, konum ve metin ağırlığıyla birlikte belirtilir.

### Weather Decision Field

İmza bileşenidir. Şehir ve plaka kodu, ana sıcaklık, koşul cümlesi ve “Sıradaki değişim” aynı yüzeyde asimetrik fakat net bir okuma sırasına sahiptir. Altındaki feels-like, yüksek/düşük, nem ve rüzgâr değerleri kart olmayan bölünmüş bir metric rail oluşturur.

### Forecast Atlas

Chart, saatlik tahmin ve günlük satırlar ayrı kartlara bölünmez. Tek bir tahmin yüzeyi içinde çizgi, tipografi ve yoğunlukla katmanlanır; safran yalnızca yaklaşan ilk anlamlı değişimi işaretler.

## 6. Do's and Don'ts

### Do:

- **Do** ilk mobil viewport'ta şehir, mevcut koşul ve sıradaki değişimi birlikte göster.
- **Do** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px` spacing ölçeğini kullan.
- **Do** ana akışta bir baskın Weather Decision Field, bir Forecast Atlas ve en fazla bir çevresel bilgi yüzeyi kullan.
- **Do** renk anlamını ikon, metin veya desenle destekle; renge tek başına görev yükleme.
- **Do** topoğrafik çizgi, koordinat ve plaka kodunu düşük dozda markasal imza olarak kullan.
- **Do** tüm klavye odaklarını görünür, tüm dokunma hedeflerini en az `44×44px` yap.

### Don't:

- **Don't** sıradan mavi-mor hava durumu şablonları kullan.
- **Don't** dekoratif glassmorphism ve bulanık cam kart yığınları kullan.
- **Don't** emoji tabanlı hava ikonları kullan.
- **Don't** her bilginin eşit önemde göründüğü kart mozaiği kur.
- **Don't** ürün bağlamından kopuk, jenerik SaaS veya Awwwards süslemeleri ekle.
- **Don't** sadece estetik amaçlı ağır animasyon ve atmosfer efektleri kullan.
- **Don't** `border-left` veya `border-right` ile `1px` üzeri renkli vurgu şeridi oluştur.
- **Don't** kartları kartların içine yerleştir veya bütün veri gruplarını ayrı yuvarlak yüzeylere çevir.
- **Don't** uyarı, yardım veya eylem metnini `0.875rem` altına indir.
- **Don't** focus göstergesini kaldır, hover'ı tek etkileşim sinyali yap veya reduced-motion tercihini yok say.
