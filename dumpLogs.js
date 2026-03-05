const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER_ERROR:', err.toString()));
        page.on('requestfailed', req => console.log('BROWSER_REQ_FAILED:', req.url(), req.failure().errorText));

        await page.goto('http://localhost:3004', { waitUntil: 'networkidle2' });

        await new Promise(resolve => setTimeout(resolve, 2000));
        await browser.close();
    } catch (e) {
        console.error("Puppeteer Error:", e);
    }
})();
