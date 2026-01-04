import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGETS = [
    { url: 'https://digitaltwin.cl/', name: 'digitaltwin' },
    { url: 'https://minverso.com/', name: 'minverso' }
];

const OUTPUT_DIR = path.join(process.cwd(), 'server', 'data', 'documentos');

async function scrape() {
    console.log('Starting scraper (Retry)...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        for (const { url, name } of TARGETS) {
            console.log(`\nProcessing: ${name}`);
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            try {
                // Use domcontentloaded which is faster and less prone to hanging on analytics/ads
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

                // Wait for potential dynamic content
                console.log(`Waiting for content to settle on ${name}...`);
                await new Promise(r => setTimeout(r, 8000));

                const content = await page.evaluate(() => document.body.innerText);

                if (content.length < 100) {
                    console.warn(`WARNING: Scraped content for ${name} seems too short (${content.length} chars).`);
                }

                const filePath = path.join(OUTPUT_DIR, `${name}.txt`);
                await fs.writeFile(filePath, content, 'utf-8');
                console.log(`Saved ${content.length} chars to ${name}.txt`);

            } catch (innerErr) {
                console.error(`Error scraping ${name}:`, innerErr.message);
            } finally {
                await page.close();
            }
        }
    } catch (err) {
        console.error('Global error:', err);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
}

scrape();
