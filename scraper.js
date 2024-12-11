const puppeteer = require('puppeteer');
const fs = require('fs');

// Configuration
const META_BASE_URL = 'https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-';
const YOUTUBE_CHANGELOG_URL = 'https://developers.google.com/youtube/v3/revision_history';
const START_YEAR = 2023;
const OUTPUT_FILE = 'changelog.json';

function determineChangeType(title, details) {
    // Helper function to categorize changes
    if (title.toLowerCase().includes('deprecat') || details.some(d => d.toLowerCase().includes('deprecat'))) {
        return 'Deprecation';
    }
    if (title.toLowerCase().includes('api')) {
        return 'API Update';
    }
    return 'Feature Update';
}

async function scrapeChangelog(page, url, year) {
    try {
        console.log(`\nScraping changelog for ${year}...`);
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Extract the changelog data
        const changes = await page.evaluate(() => {
            const changes = [];
            const dateSections = document.querySelectorAll('h2');
            
            dateSections.forEach(dateSection => {
                const dateText = dateSection.textContent.trim();
                if (!dateText.match(/[A-Za-z]+ \d+, \d{4}/)) return;
                
                let currentNode = dateSection.nextElementSibling;
                let currentChange = null;

                while (currentNode && currentNode.tagName !== 'H2') {
                    if (currentNode.tagName === 'H3') {
                        if (currentChange) {
                            changes.push(currentChange);
                        }
                        
                        currentChange = {
                            date: dateText,
                            title: currentNode.textContent.trim(),
                            raw_endpoints: [],
                            details: [],
                            links: [],
                            isDeprecation: currentNode.closest('.deprecation-announcement') !== null
                        };
                    } else if (currentChange) {
                        // Extract code blocks for endpoints
                        const codeBlocks = currentNode.querySelectorAll('code');
                        codeBlocks.forEach(code => {
                            const endpoint = code.textContent.trim();
                            if (endpoint) {
                                currentChange.raw_endpoints.push(endpoint);
                            }
                        });
                        
                        // Extract links
                        const links = currentNode.querySelectorAll('a');
                        links.forEach(link => {
                            currentChange.links.push({
                                text: link.textContent.trim(),
                                url: link.href
                            });
                        });
                        
                        // Extract text content
                        const text = currentNode.textContent.trim();
                        if (text) {
                            currentChange.details.push(text);
                        }
                    }
                    currentNode = currentNode.nextElementSibling;
                }
                
                if (currentChange) {
                    changes.push(currentChange);
                }
            });
            
            return changes;
        });

        // Process and format the changes according to our schema
        return changes.map(change => {
            // Parse endpoints into structured format
            const endpoints = change.raw_endpoints.map(endpoint => {
                const parts = endpoint.split(' ');
                return {
                    method: parts[0] || '',
                    path: parts[1] || endpoint,
                    status: 'active'
                };
            });

            // Determine if this is a breaking change
            const isBreaking = change.details.some(d => 
                d.toLowerCase().includes('breaking') || 
                d.toLowerCase().includes('deprecated') ||
                d.toLowerCase().includes('removed')
            );

            return {
                platform: 'Meta',
                date: change.date,
                year: parseInt(change.date.split(', ')[1]),
                title: change.title,
                type: determineChangeType(change.title, change.details),
                
                version_info: {
                    applies_to: null,  // Meta doesn't typically specify this in changelog
                    effective_date: null
                },

                endpoints: endpoints,
                fields: [],  // Could be enhanced to detect field changes

                description: change.details[0] || '',  // First detail is usually the main description
                details: change.details.slice(1),  // Remaining details
                
                links: change.links,

                flags: {
                    is_deprecation: change.isDeprecation,
                    is_breaking_change: isBreaking,
                    requires_action: isBreaking
                },

                platform_specific: {
                    products: ['Graph API']
                }
            };
        });

    } catch (error) {
        console.error(`Error scraping ${year}:`, error.message);
        return [];
    }
}

async function scrapeYouTubeChangelog(page) {
    try {
        console.log('\nScraping YouTube changelog...');
        await page.goto(YOUTUBE_CHANGELOG_URL, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Extract the changelog data
        const changes = await page.evaluate((startYear) => {
            const changes = [];
            const releaseNotes = document.querySelectorAll('a[name^="release_notes_"]');
            
            for (const anchor of releaseNotes) {
                // Get the next h3 element which contains the date
                const dateHeader = anchor.nextElementSibling;
                if (!dateHeader || !dateHeader.tagName === 'H3') continue;

                const dateText = dateHeader.textContent.trim();
                const date = new Date(dateText);
                const year = date.getFullYear();

                // Skip changes before startYear
                if (year < startYear) continue;

                // Initialize the change object
                let currentChange = {
                    date: dateText,
                    title: '', // Will be determined based on content
                    details: [],
                    endpoints: [],
                    links: []
                };

                // Process content until next release note or major section
                let currentNode = dateHeader.nextElementSibling;
                while (currentNode && 
                       !currentNode.matches('a[name^="release_notes_"]') && 
                       !currentNode.matches('h2')) {
                    
                    // Extract text content
                    if (currentNode.textContent.trim()) {
                        // If this is the first content and we don't have a title,
                        // use it as title, otherwise add to details
                        if (!currentChange.title && currentNode.tagName !== 'P') {
                            currentChange.title = currentNode.textContent.trim();
                        } else {
                            currentChange.details.push(currentNode.textContent.trim());
                        }
                    }

                    // Extract endpoints from code blocks
                    const codeBlocks = currentNode.querySelectorAll('code');
                    codeBlocks.forEach(code => {
                        const endpoint = code.textContent.trim();
                        if (endpoint) {
                            currentChange.endpoints.push(endpoint);
                        }
                    });

                    // Extract links
                    const links = currentNode.querySelectorAll('a');
                    links.forEach(link => {
                        currentChange.links.push({
                            text: link.textContent.trim(),
                            url: link.href
                        });
                    });

                    currentNode = currentNode.nextElementSibling;
                }

                // If we gathered any meaningful content, add to changes
                if (currentChange.details.length > 0) {
                    changes.push(currentChange);
                }
            }
            
            return changes;
        }, START_YEAR);

        // Process and format the changes according to our schema
        return changes.map(change => {
            // Analyze content to determine change type
            const isDeprecation = change.details.some(d => 
                d.toLowerCase().includes('deprecat') ||
                d.toLowerCase().includes('will stop supporting')
            );
            
            const isBreaking = isDeprecation || change.details.some(d => 
                d.toLowerCase().includes('breaking') || 
                d.toLowerCase().includes('removed')
            );

            // Format endpoints into structured format
            const endpoints = change.endpoints.map(endpoint => {
                const parts = endpoint.split(' ');
                return {
                    method: parts[0] || '',
                    path: parts[1] || endpoint,
                    status: 'active'
                };
            });

            return {
                platform: 'YouTube',
                date: change.date,
                year: new Date(change.date).getFullYear(),
                title: change.title || 'API Update', // Default title if none found
                type: isDeprecation ? 'Deprecation' : 
                      change.title.toLowerCase().includes('api') ? 'API Update' : 
                      'Feature Update',

                version_info: {
                    applies_to: null,
                    effective_date: null
                },

                endpoints: endpoints,
                fields: [], // Could be enhanced to detect field changes

                description: change.details[0] || '',
                details: change.details.slice(1),
                links: change.links,

                flags: {
                    is_deprecation: isDeprecation,
                    is_breaking_change: isBreaking,
                    requires_action: isBreaking
                },

                platform_specific: {
                    products: ['YouTube Data API']
                }
            };
        });

    } catch (error) {
        console.error('Error scraping YouTube changelog:', error.message);
        return [];
    }
}

async function main() {
    try {
        console.log('Starting changelog scraper...');
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Scrape Meta changes
        const currentYear = new Date().getFullYear();
        let allChanges = [];

        for (let year = START_YEAR; year <= currentYear; year++) {
            const url = `${META_BASE_URL}${year}`;
            const changes = await scrapeChangelog(page, url, year);
            allChanges = allChanges.concat(changes);
        }

        // Scrape YouTube changes
        const youtubeChanges = await scrapeYouTubeChangelog(page);
        allChanges = allChanges.concat(youtubeChanges);

        // Sort all changes by date (newest first)
        allChanges.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create final data structure
        const finalData = {
            last_updated: new Date().toISOString(),
            metadata: {
                platforms: ['Meta', 'YouTube'],
                years_covered: `${START_YEAR}-${currentYear}`,
                total_changes: allChanges.length
            },
            changes: allChanges
        };

        // Save to JSON file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
        console.log(`\nSaved changelog to ${OUTPUT_FILE}`);
        console.log(`Total changes: ${finalData.metadata.total_changes}`);

        await browser.close();
        console.log('\nScraping completed successfully!');

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the scraper
main();