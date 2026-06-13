const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');

const LOCK_FILE = path.join(__dirname, '.setup_complete');
const NO_STOCKFISH_FILE = path.join(__dirname, '.no_stockfish');

if (fs.existsSync(LOCK_FILE)) {
    process.exit(0);
}

function promptUser(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function runSetup() {
    console.log('--- ShinoaBot Ilk Kurulum Denetleyicisi ---');
    console.log('Gereksinimler kontrol ediliyor...\n');

    let hasError = false;

    // 1. node_modules
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('[BILGI] Gerekli npm kütüphaneleri bulunamadi. İndiriliyor (Bu islem internet hiziniza bagli olarak biraz surebilir)...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('✅ Kütüphaneler basariyla kuruldu.\n');
        } catch (err) {
            console.error('❌ HATA: npm install sirasinda bir hata olustu.');
            hasError = true;
        }
    } else {
        console.log('✅ NPM kütüphaneleri kurulu.');
    }

    // 2. .env
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    const requiredVars = [
        { key: 'TOKEN', req: true, desc: 'Discord Bot Tokeni (Zorunlu)' },
        { key: 'CLIENTID', req: true, desc: 'Discord Bot Client ID (Slash komutlarini yuklemek icin zorunlu)' },
        { key: 'OWNERID', req: false, desc: 'Bot Sahibinin Discord IDsi eksik. Geliştirici komutlari kullanilamaz.' },
        { key: 'DEV', req: false, silent: true, desc: 'İkinci gelistirici IDsi eksik.' },
        { key: 'OTOKEN', req: false, desc: 'OpenRouter API Key eksik. Yapay zeka komutlari calismayacaktir.' },
        { key: 'TENORKEY', req: false, desc: 'Tenor API Key eksik. Gif komutlari calismayacaktir.' }
    ];

    if (!fs.existsSync(envPath)) {
        console.error('❌ HATA: .env dosyasi bulunamadi!');
        let exampleContent = "";
        requiredVars.forEach(v => { exampleContent += `${v.key}=YOUR_${v.key}_HERE\n`; });
        fs.writeFileSync(envExamplePath, exampleContent);
        console.log(`[BILGI] Sizin icin bir '.env.example' dosyasi olusturuldu.\nLutfen bu dosyanin adini '.env' olarak degistirin ve icindeki tum bilgileri kendi botunuza gore doldurun.`);
        hasError = true;
    } else {
        console.log('✅ .env dosyasi mevcut.');
        const envContent = fs.readFileSync(envPath, 'utf8');
        requiredVars.forEach(v => {
            const match = envContent.match(new RegExp(`${v.key}\\s*=\\s*(.*)`));
            const val = match ? match[1].trim() : '';
            if (!val || val.includes('YOUR_')) {
                if (v.req) {
                    console.error(`❌ HATA: .env dosyasinda ${v.key} eksik veya varsayilan birakilmis. ${v.desc}`);
                    hasError = true;
                } else if (!v.silent) {
                    console.log(`⚠️ UYARI: .env dosyasinda ${v.key} ayarlanmamis. ${v.desc}`);
                }
            }
        });
    }

    // 3. Media
    const bannerPath = path.join(__dirname, 'media', 'banner.gif');
    if (!fs.existsSync(bannerPath)) {
        console.log('⚠️ UYARI: media/banner.gif dosyasi bulunamadi. Bot calismaya devam edecek ancak /setbanner komutunu kullanamayabilirsiniz.');
    } else {
        console.log('✅ Medya dosyalari mevcut.');
    }

    // 3.5. cookies.txt — YouTube bot bypass
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    if (!fs.existsSync(cookiesPath)) {
        console.log('\n⚠️  UYARI: cookies.txt bulunamadi.');
        console.log('   [BILGI] YouTube bot korumasini asmak icin bu dosya gereklidir.');
        console.log('   [BILGI] Nasil olusturulur:');
        console.log('     1. Chrome\'a "Get cookies.txt LOCALLY" uzantisini ekleyin');
        console.log('     2. YouTube.com\'a giris yapin');
        console.log('     3. Uzantidan cerezleri disa aktarin ve "cookies.txt" olarak');
        console.log('        bu klasore (ShinoaBot/cookies.txt) kaydedin\n');
    } else {
        console.log('✅ cookies.txt mevcut.');
    }

    // 4. Stockfish
    if (!fs.existsSync(NO_STOCKFISH_FILE) && !hasError) {
        const stockfishDir = path.join(__dirname, 'stockfish');
        if (!fs.existsSync(stockfishDir)) fs.mkdirSync(stockfishDir);
        
        const files = fs.readdirSync(stockfishDir);
        // Eğer stockfish isminde bir exe varsa veya nokta içermiyorsa (Linux/Mac binary)
        let hasExecutable = false;
        
        function checkDirForExecutable(dir) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    checkDirForExecutable(fullPath);
                } else {
                    if (item.toLowerCase().includes('stockfish') && (item.endsWith('.exe') || !item.includes('.'))) {
                        hasExecutable = true;
                    }
                }
            }
        }
        checkDirForExecutable(stockfishDir);

        if (!hasExecutable) {
            console.log('\n⚠️ Stockfish satranc motoru bulunamadi.');
            const ans = await promptUser('Yapay zekanin satranc analiz ozelligini ve /chess komutunu kullanabilmek icin Stockfish (yaklasik 40MB) indirmek ister misiniz? (E/H): ');
            if (ans.trim().toLowerCase() === 'e') {
                console.log('Stockfish indiriliyor, lutfen bekleyin...');
                try {
                    let downloadUrl = '';
                    let archiveExt = '';
                    const platform = os.platform();
                    if (platform === 'win32') {
                        downloadUrl = 'https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-windows-x86-64-avx2.zip';
                        archiveExt = '.zip';
                    } else if (platform === 'linux') {
                        downloadUrl = 'https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64-avx2.tar';
                        archiveExt = '.tar';
                    } else if (platform === 'darwin') {
                        downloadUrl = 'https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-macos-x86-64.tar';
                        archiveExt = '.tar';
                    } else {
                        throw new Error('Desteklenmeyen isletim sistemi.');
                    }
                    
                    const archivePath = path.join(stockfishDir, `stockfish${archiveExt}`);
                    await downloadFile(downloadUrl, archivePath);
                    console.log('Indirme tamamlandi. Arsiv cikartiliyor...');
                    execSync(`tar -xf "${archivePath}" -C "${stockfishDir}"`);
                    fs.unlinkSync(archivePath);
                    console.log('✅ Stockfish basariyla kuruldu.');
                } catch (err) {
                    console.error('❌ Stockfish indirilirken hata olustu:', err.message);
                    console.log('Lutfen Stockfishi manuel olarak stockfish/ klasorune indirin.');
                }
            } else {
                console.log('Stockfish kurulumu atlandi. Satranc komutlari devre disi birakilacak.');
                fs.writeFileSync(NO_STOCKFISH_FILE, 'User declined stockfish download');
            }
        } else {
            console.log('✅ Stockfish motoru mevcut.');
        }
    }
    // 5. yt-dlp binary
    const binDir = path.join(__dirname, 'src', 'bin');
    const ytDlpBin = path.join(binDir, os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

    if (!fs.existsSync(ytDlpBin)) {
        console.log('\n[BILGI] yt-dlp bulunamadi, indiriliyor...');
        if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
        try {
            // Try pip first (fastest, no download needed if Python available)
            const pipResult = spawnSync('pip', ['show', 'yt-dlp'], { encoding: 'utf8' });
            if (pipResult.status === 0 && pipResult.stdout.includes('Version')) {
                // pip yt-dlp is installed, copy to bin
                const pipDlp = spawnSync('python', ['-c',
                    'import sys, os; import yt_dlp; print(os.path.dirname(sys.executable))'
                ], { encoding: 'utf8' });
                let copied = false;
                if (pipDlp.status === 0) {
                    const scriptsDir = path.join(pipDlp.stdout.trim(), os.platform() === 'win32' ? 'Scripts' : '');
                    const src = path.join(scriptsDir, os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
                    if (fs.existsSync(src)) {
                        fs.copyFileSync(src, ytDlpBin);
                        if (os.platform() !== 'win32') fs.chmodSync(ytDlpBin, '755');
                        console.log('✅ yt-dlp pip kurulumundan kopyalandi.');
                        copied = true;
                    }
                }
                if (!copied) throw new Error('pip kopyalama basarisiz');
            } else {
                throw new Error('pip yok');
            }
        } catch {
            // Fallback: download from GitHub via yt-dlp-wrap
            try {
                const YTDlpWrap = require('yt-dlp-wrap').default;
                await YTDlpWrap.downloadFromGithub(ytDlpBin);
                if (os.platform() !== 'win32') fs.chmodSync(ytDlpBin, '755');
                console.log('✅ yt-dlp GitHub\'tan indirildi.');
            } catch (err) {
                console.log('⚠️ UYARI: yt-dlp indirilemedi. Muzik komutu calismayadilir. Hata:', err.message);
            }
        }
    } else {
        console.log('✅ yt-dlp mevcut.');
    }

    if (hasError) {
        console.log('\n❌ Kurulum tamamlanamadi! Lutfen yukaridaki hatalari giderip run.bat veya run.sh dosyasini tekrar calistirin.');
        process.exit(1);
    } else {
        console.log('\n✅ Tum gereksinimler basariyla karsilandi!');
        fs.writeFileSync(LOCK_FILE, 'Setup completed successfully.');
        process.exit(0);
    }
}

runSetup();

