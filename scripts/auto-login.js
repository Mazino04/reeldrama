/**
 * ReelDrama - 100% Automated Narto Drama Session Refresher
 * 
 * Uses Playwright with a persistent stealth Chrome profile to automatically
 * solve Cloudflare Turnstile, submit email/password, extract fresh session cookies,
 * and sync them directly into app.js and nd_cookies.txt.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Target credentials (can be overridden via environment variables or CLI arguments)
const EMAIL = process.env.NARTO_EMAIL || process.argv[2] || 'aleperaza44@gmail.com';
const PASSWORD = process.env.NARTO_PASSWORD || process.argv[3] || 'Spotty#03';

async function autoLogin() {
    console.log('========================================================');
    console.log('🚀 Starting Automated Narto Drama Login via Playwright');
    console.log(`👤 Account: ${EMAIL}`);
    console.log('========================================================\n');

    console.log('1️⃣  Launching Chrome with stealth anti-bot bypass...');
    const browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Mask navigator.webdriver
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });

    let loginResponseData = null;

    // Listen for the /auth/email/login response
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/auth/email/login')) {
            try {
                loginResponseData = {
                    status: response.status(),
                    body: await response.text()
                };
                console.log(`📡 Intercepted /auth/email/login response [Status: ${response.status()}]`);
            } catch (_) {}
        }
    });

    console.log('2️⃣  Navigating to https://narto-drama.com ...');
    await page.goto('https://narto-drama.com', { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait for homepage and login trigger button
    console.log('⏳ Waiting for homepage and auth button to initialize...');
    try {
        await page.waitForSelector('#frontend-auth-open', { state: 'attached', timeout: 30000 });
        console.log('✅ Found #frontend-auth-open button.');
    } catch (err) {
        console.log('Current URL:', page.url());
        console.log('Current Title:', await page.title());
        await page.waitForTimeout(4000);
    }

    // Open login modal
    console.log('3️⃣  Opening Login Modal...');
    const openBtn = await page.$('#frontend-auth-open');
    if (openBtn) {
        await openBtn.click();
        await page.waitForTimeout(1000);
    }

    // Fill credentials
    console.log('4️⃣  Filling credentials...');
    await page.waitForSelector('#nd-auth-login-email', { state: 'visible', timeout: 15000 });
    await page.fill('#nd-auth-login-email', EMAIL);
    await page.waitForTimeout(200);

    await page.fill('#nd-auth-login-password', PASSWORD);
    await page.waitForTimeout(300);

    // Wait for Cloudflare Turnstile token to auto-populate
    console.log('5️⃣  Waiting for Cloudflare Turnstile verification...');
    let tokenReady = false;
    for (let i = 1; i <= 30; i++) {
        const tokenLength = await page.evaluate(() => {
            const el = document.querySelector('[data-panel="email-login"] [name="cf-turnstile-response"]');
            return el && el.value ? el.value.length : 0;
        });

        if (tokenLength > 20) {
            tokenReady = true;
            console.log(`✅ Cloudflare Turnstile verified automatically! (Token length: ${tokenLength})`);
            break;
        }

        await page.waitForTimeout(1000);
    }

    if (!tokenReady) {
        console.error('❌ Cloudflare Turnstile verification timed out.');
        await context.close();
        process.exit(1);
    }

    // Submit login form
    console.log('6️⃣  Submitting login form...');
    const submitBtn = await page.$('#nd-auth-login-submit');
    if (submitBtn) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }

    // Wait for authentication response
    console.log('⏳ Waiting for authentication confirmation...');
    for (let i = 0; i < 15; i++) {
        if (loginResponseData) break;
        await page.waitForTimeout(1000);
    }

    if (loginResponseData) {
        console.log(`Login Response [${loginResponseData.status}]:`, loginResponseData.body.slice(0, 300));
        let json = null;
        try { json = JSON.parse(loginResponseData.body); } catch (_) {}
        if (loginResponseData.status !== 200 || (json && json.ok === false)) {
            console.error('\n❌ Login rejected by server: ' + (json?.message || `HTTP ${loginResponseData.status}`));
            await browser.close();
            process.exit(1);
        }
    } else {
        console.error('\n❌ No login response intercepted from server.');
        await browser.close();
        process.exit(1);
    }

    // Allow cookies to be set in the browser context
    await page.waitForTimeout(3000);

    // Extract all cookies from context
    console.log('7️⃣  Extracting session cookies...');
    const cookies = await context.cookies();
    const cookieMap = {};
    cookies.forEach(c => {
        cookieMap[c.name] = c.value;
    });

    const laravelSession = cookieMap['laravel-session'];
    const xsrfToken = cookieMap['XSRF-TOKEN'];
    const cfClearance = cookieMap['cf_clearance'];
    const ndCk = cookieMap['nd_ck'];

    console.log('\n--- COOKIE SUMMARY ---');
    console.log(`laravel-session: ${laravelSession ? 'FOUND (' + laravelSession.slice(0, 25) + '...)' : 'MISSING'}`);
    console.log(`XSRF-TOKEN:      ${xsrfToken ? 'FOUND' : 'MISSING'}`);
    console.log(`cf_clearance:    ${cfClearance ? 'FOUND' : 'MISSING'}`);
    console.log(`nd_ck:           ${ndCk ? 'FOUND' : 'MISSING'}`);

    if (!laravelSession) {
        console.error('\n❌ Error: laravel-session cookie was not found in browser context.');
        await browser.close();
        process.exit(1);
    }

    // Build the full cookie header string
    const cookieParts = [];
    if (laravelSession) cookieParts.push(`laravel-session=${laravelSession}`);
    if (xsrfToken) cookieParts.push(`XSRF-TOKEN=${xsrfToken}`);
    if (cfClearance) cookieParts.push(`cf_clearance=${cfClearance}`);
    if (ndCk) cookieParts.push(`nd_ck=${ndCk}`);
    const fullCookieString = cookieParts.join('; ');

    // 1. Write to nd_cookies.txt
    const cookieTxtPath = path.join(__dirname, '..', 'nd_cookies.txt');
    fs.writeFileSync(cookieTxtPath, fullCookieString, 'utf-8');
    console.log(`\n💾 Saved full cookie string to: ${cookieTxtPath}`);

    // 2. Write JSON format for tooling
    const sessionJsonPath = path.join(__dirname, '..', 'nd_session.json');
    fs.writeFileSync(sessionJsonPath, JSON.stringify({
        updatedAt: new Date().toISOString(),
        account: EMAIL,
        cookies: cookieMap,
        fullCookieString
    }, null, 2), 'utf-8');
    console.log(`💾 Saved session JSON to: ${sessionJsonPath}`);

    // 3. Automatically patch app.js with the clean, correctly encoded DEFAULT_ND_SESSION_COOKIE
    const appJsPath = path.join(__dirname, '..', 'app.js');
    if (fs.existsSync(appJsPath)) {
        let appJs = fs.readFileSync(appJsPath, 'utf-8');
        const defaultCookieRegex = /const\s+DEFAULT_ND_SESSION_COOKIE\s*=\s*['"][^'"]*['"];/;
        const newCookieLine = `const DEFAULT_ND_SESSION_COOKIE = '${fullCookieString}';`;

        if (defaultCookieRegex.test(appJs)) {
            appJs = appJs.replace(defaultCookieRegex, newCookieLine);
            fs.writeFileSync(appJsPath, appJs, 'utf-8');
            console.log(`✅ Automatically updated DEFAULT_ND_SESSION_COOKIE in app.js!`);
        } else {
            console.warn('⚠️ Could not locate DEFAULT_ND_SESSION_COOKIE in app.js');
        }
    }

    console.log('\n========================================================');
    console.log('🎉 SUCCESS! Login completed and session cookies updated.');
    console.log('========================================================\n');

    await browser.close();
}

autoLogin().catch(err => {
    console.error('\n❌ Fatal error during auto login:', err.message || err);
    process.exit(1);
});
