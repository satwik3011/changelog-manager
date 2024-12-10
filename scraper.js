const fs = require('fs');
const puppeteer = require('puppeteer');

async function scrapeChangelog() {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',  // Use the new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        // Set a realistic viewport
        await page.setViewport({
            width: 1280,
            height: 800
        });

        console.log('Navigating to page...');
        await page.goto('https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-2024', {
            waitUntil: 'networkidle0'
        });

        // Wait for the content to load
        await page.waitForSelector('h2');

        // Get the HTML content
        const html = await page.content();
        
        // Save the raw HTML
        fs.writeFileSync('changelog.html', html);
        console.log('Raw HTML saved to changelog.html');

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

        const result = {
            total_changes: changes.length,
            last_updated: changes[0]?.date || 'Unknown',
            changes: changes
        };

        // Write to JSON file
        fs.writeFileSync('changelog.json', JSON.stringify(result, null, 2));
        console.log('Changelog has been scraped and saved to changelog.json');
        console.log(`Total changes found: ${result.total_changes}`);
        console.log(`Last updated: ${result.last_updated}`);

        await browser.close();

    } catch (error) {
        console.error('Error scraping changelog:', error);
    }
}

// Run the scraper
scrapeChangelog();