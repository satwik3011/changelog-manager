const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-';
const START_YEAR = 2023; // Earliest available year
const OUTPUT_DIR = 'output';

async function generateYearUrls() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = START_YEAR; year <= currentYear; year++) {
        years.push({
            year: year,
            url: `${BASE_URL}${year}`
        });
    }
    return years;
}

async function scrapeChangelog(page, url) {
    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for the content to load
        await page.waitForSelector('h2');

        // Extract the changelog data
        const changes = await page.evaluate(() => {
            const changesList = [];
            
            // Find all h2 elements (date sections)
            const dateSections = document.querySelectorAll('h2');
            
            dateSections.forEach(dateSection => {
                const dateText = dateSection.textContent.trim();
                
                // Skip if this isn't a date heading
                if (!dateText.match(/[A-Za-z]+ \d+, \d{4}/)) return;
                
                // Get the next elements until another h2
                let currentNode = dateSection.nextElementSibling;
                while (currentNode && currentNode.tagName !== 'H2') {
                    if (currentNode.tagName === 'H3') {
                        const changeType = currentNode.textContent.trim();
                        
                        // Collect details and endpoints
                        const details = [];
                        const endpoints = [];
                        
                        let nextNode = currentNode.nextElementSibling;
                        while (nextNode && !['H2', 'H3'].includes(nextNode.tagName)) {
                            // Extract endpoints from code blocks
                            nextNode.querySelectorAll('code').forEach(code => {
                                const endpoint = code.textContent.trim();
                                if (endpoint) endpoints.push(endpoint);
                            });
                            
                            // Extract other content as details
                            const text = nextNode.textContent.trim();
                            if (text && !endpoints.includes(text)) {
                                details.push(text);
                            }
                            
                            nextNode = nextNode.nextElementSibling;
                        }
                        
                        changesList.push({
                            date: dateText,
                            type: changeType,
                            endpoints: endpoints,
                            details: details.filter(d => d.length > 0)
                        });
                    }
                    currentNode = currentNode.nextElementSibling;
                }
            });
            
            return changesList;
        });

        return changes;

    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return [];
    }
}

async function saveResults(year, changes) {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const yearData = {
        year: year,
        total_changes: changes.length,
        last_updated: changes[0]?.date || 'Unknown',
        changes: changes
    };

    // Save individual year file
    const yearFilePath = path.join(OUTPUT_DIR, `changelog_${year}.json`);
    fs.writeFileSync(yearFilePath, JSON.stringify(yearData, null, 2));
    console.log(`Saved ${year} changelog to ${yearFilePath}`);

    return yearData;
}

async function generateMasterChangelog(allYearData) {
    const masterData = {
        last_updated: new Date().toISOString(),
        total_years: allYearData.length,
        total_changes: allYearData.reduce((sum, year) => sum + year.total_changes, 0),
        years: allYearData.sort((a, b) => b.year - a.year) // Sort newest first
    };

    const masterFilePath = path.join(OUTPUT_DIR, 'changelog_master.json');
    fs.writeFileSync(masterFilePath, JSON.stringify(masterData, null, 2));
    console.log(`Saved master changelog to ${masterFilePath}`);
}

async function main() {
    try {
        console.log('Starting changelog scraper...');
        
        // Generate URLs for all years
        const yearUrls = await generateYearUrls();
        console.log(`Found ${yearUrls.length} years to scrape`);

        // Launch browser
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Scrape each year
        const allYearData = [];
        for (const { year, url } of yearUrls) {
            console.log(`\nProcessing year ${year}...`);
            
            const changes = await scrapeChangelog(page, url);
            if (changes.length > 0) {
                const yearData = await saveResults(year, changes);
                allYearData.push(yearData);
            }
        }

        // Generate master changelog
        await generateMasterChangelog(allYearData);

        await browser.close();
        console.log('\nScraping completed successfully!');

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the scraper
main();