# SubFlow - YouTube Subtitle Vocabulary Trainer

Modern, minimal ve flat design ile tasarlanmış Chrome eklentisi. YouTube altyazılarında kelimeleri akıllıca renklendirerek dil öğrenimini destekler.

## ✨ Özellikler

- 🎨 **Minimal Flat Design** - Temiz, modern ve kullanımı kolay arayüz
- 📚 **Akıllı Kelime Yönetimi** - Bilinen ve öğrenilen kelimelerinizi takip edin
- 🌐 **Otomatik Çeviri** - Kelimeleri otomatik olarak seçtiğiniz dile çevirir
- 🎯 **YouTube Entegrasyonu** - Altyazılarda kelimelerinizi otomatik renklendirir
- 💾 **İçe/Dışa Aktarma** - Kelime listenizi yedekleyin
- 🎨 **Özelleştirilebilir Renkler** - Bilinen ve öğrenilen kelimeler için istediğiniz rengi seçin

## 🚀 Kullanım

### Ana Ekran

**2 Ana Tab:**

1. **Ana Ekran** - Kelime listesi ve arama
2. **Ayarlar** - Tüm yapılandırma seçenekleri

**Kelime Ekleme:**

1. YouTube'da altyazılı video açın
2. Eklentinin aktif olduğundan emin olun
3. Altyazıda bir kelimeye **Ctrl + Tık** yapın
4. Açılan menüden kelime durumunu seçin:
   - ✅ **Biliyorum** (Yeşil renkte gösterilir)
   - 📚 **Öğreneceğim** (Turuncu renkte gösterilir)

**Kelime Görüntüleme:**

- **Tümü** - Tüm kelimeleriniz
- **Bilinen** - Sadece bildiğiniz kelimeler
- **Öğrenilen** - Öğrenmek istediğiniz kelimeler
- Arama kutusundan kelime arayabilirsiniz
- Kelimelere tıklayarak durumunu değiştirebilirsiniz

### Ayarlar

**Genel:**

- ⚡ **Eklentiyi Etkinleştir** - Eklentiyi aç/kapat
- 🌐 **Çevirileri Göster** - Otomatik çevirileri göster/gizle
- 🇹🇷 **Dil Seçimi** - Çeviri dili seçimi (TR, EN, DE, ES, FR, vb.)

**Renkler:**

- Bilinen kelimeler için renk seçimi
- Öğrenilen kelimeler için renk seçimi

**İşlemler:**

- 🔄 **YouTube'u Yenile** - Mevcut YouTube sekmesini yenile
- 🌐 **Tüm Kelimeleri Çevir** - Tüm kelimeleri toplu çevir
- 📤 **Dışa Aktar** - Kelimelerinizi JSON olarak kaydet
- 📥 **İçe Aktar** - Daha önce kaydedilmiş kelimeleri yükle
- 🗑 **Temizle** - Tüm kelimeleri sil

## 🏗️ Proje Yapısı

```
Subtitle Colorer/
├── manifest.json              # Chrome extension manifest
├── perfect-mimic.js           # Ana entry point - modülleri yükler
├── popup.html                 # Popup arayüzü
├── js/                        # JavaScript modülleri
│   ├── config/
│   │   └── shared-config.js   # Konfigürasyon ve sabitler
│   ├── messaging/
│   │   └── message-protocol.js # Popup ↔ Content script iletişimi
│   ├── storage/
│   │   └── storage-manager.js  # Queue-based storage sistemi
│   ├── services/
│   │   └── translation-service.js # Google Translate API servisi
│   ├── popup/
│   │   └── popup.js           # Popup UI ve mantığı
│   ├── background/
│   │   └── background.js      # Background service worker
│   ├── content/
│   │   └── content.js         # Eski content script (arşiv)
│   ├── utils.js               # Yardımcı fonksiyonlar
│   ├── subtitle-system.js     # Ana altyazı sistemi
│   ├── word-manager.js        # Kelime yönetimi
│   └── menu-system.js         # Popup menü sistemi
├── styles/                    # CSS modülleri
│   ├── base.css               # Temel reset ve yardımcı stiller
│   ├── subtitle-core.css      # Altyazı konteyneri stilleri
│   ├── subtitle-words.css     # Kelime renklendirme stilleri
│   ├── popup-menu.css         # Popup menü tasarımı
│   ├── responsive.css         # Responsive breakpoint'ler
│   ├── perfect-mimic-styles.css # Eski CSS (arşiv)
│   └── styles.css             # Eski CSS (arşiv)
└── assets/                    # İkonlar ve görseller
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    ├── logo.png
    └── logo.svg
```

## 📦 Kurulum

### Chrome Web Store (Yakında)
