# ShinoaBot
Making a discord bot using discord.js 


## Getting Started / Kurulum

Botu kendi bilgisayarınızda çalıştırmak çok kolaydır, manuel olarak npm paketlerini kurmanıza gerek yoktur. İlk kurulumda bot kendi paketlerini indirip dosyalarını kontrol eder.

1. **İndirin:** Bu projeyi bilgisayarınıza klonlayın.
2. **Çalıştırın:** Windows kullanıyorsanız `run.bat` dosyasına çift tıklayın. Mac veya Linux kullanıyorsanız terminalden `bash run.sh` komutunu çalıştırın.
3. **Uyarıları İzleyin:** Eğer `.env` (şifre ve token bilgilerinin olduğu dosya) sistemde yoksa, bot otomatik olarak bir `.env.example` oluşturacak ve kapanacaktır.
4. **Tokenleri Girin:** Oluşan `.env.example` dosyasının adını `.env` olarak değiştirin ve içine kendi Discord Bot Token'inizi (`TOKEN=...`) ve diğer gerekli ID'lerinizi girin.
5. **Tekrar Çalıştırın:** `.env` dosyasını ayarladıktan sonra `run.bat` (veya `run.sh`) dosyasına tekrar tıklayın. Bot sorunsuz şekilde başlatılacaktır!

*Not: Detaylı gereksinimler için `requirements.txt` dosyasına göz atabilirsiniz.*

---

## Gerekli Anahtarları Alma Rehberi (Token & API)

`.env` dosyasına girmeniz gereken bilgileri nasıl bulabileceğiniz aşağıda açıklanmıştır:

### 1. Discord Bot Token (`TOKEN`) ve Client ID (`CLIENTID`)
- [Discord Developer Portal](https://discord.com/developers/applications)'a gidin.
- Sağ üstten **New Application** diyerek botunuzu oluşturun.
- Sol menüden **Bot** sekmesine gelin, **Reset Token** diyerek botunuzun tokenini kopyalayın. *(Bu tokeni kimseyle paylaşmayın!)* `TOKEN=` karşısına yapıştırın.
- Aynı sayfada aşağı kaydırıp **Privileged Gateway Intents** altındaki üç seçeneği de (Presence Intent, Server Members Intent, Message Content Intent) aktif edin.
- Sol menüden **General Information** sekmesine gelin ve oradaki **Application ID**'yi kopyalayıp `CLIENTID=` karşısına yapıştırın.

### 2. Kendi Discord ID'niz (`OWNERID` & `DEV`)
- Discord'da **Kullanıcı Ayarları > Gelişmiş** menüsünden **Geliştirici Modu**'nu açın.
- Kendi profilinize sağ tıklayıp **Kullanıcı ID'sini Kopyala** diyerek kopyaladığınız numarayı `OWNERID=` kısmına yapıştırın. Bu size geliştirici komutlarını kullanma yetkisi verir. İkinci bir yetkili isterseniz onun ID'sini `DEV=` kısmına yazabilirsiniz.

### 3. Yapay Zeka Komutları İçin (`OTOKEN`)
- `/ai` komutunun çalışması için OpenRouter API anahtarına ihtiyacınız var.
- [OpenRouter.ai](https://openrouter.ai/keys) adresine gidin, hesabınıza giriş yapın ve **Create Key** butonuna basarak ücretsiz bir API key oluşturup kopyalayın.

### 4. Gif Komutları İçin (`TENORKEY`)
- `/gif` ve `/gif2someone` komutları için Tenor API gerekir.
- [Google Cloud Console](https://console.cloud.google.com/) üzerinden bir proje oluşturun ve **Tenor API**'yi aratıp etkinleştirin.
- API'ler ve Hizmetler menüsünden yeni bir Kimlik Bilgisi (API Anahtarı) oluşturarak buraya yapıştırın.