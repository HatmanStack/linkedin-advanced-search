import express from 'express';
import Promise from 'Promise';
import puppeteer from 'puppeteer';
import fs from 'fs/promises'; 
import cors from 'cors';

const app = express();
const port = 3001;
const recencyHours = 6;   // Value assigned to a interaction that happened in the last day
const recencyDays = 5;  // Value assigned to a interaction that happened in the last 6 days
const recencyWeeks = 3; // Value assigned to a interaction that happened in the last 3 weeks
const historyToCheck = 10; // Number of times to scroll to check for interactions
const threshold = 8;  // Minimum score to consider a contact good
const pageNumberStart = 1; // Start page number for Checking People on PeopleSearch 1-100
const pageNumberEnd = 100; // End page number for Checking People on PeopleSearch 1-100


app.use(cors({
  origin: 'http://localhost:3000', // React app's URL
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

async function GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber) {
  const url = `https://www.linkedin.com/search/results/people/?currentCompany=%5B"${extractedCompanyNumber}"%5D&geoUrn=%5B"${extractedGeoNumber}"%5D&keywords=${encodedRole}&origin=FACETED_SEARCH&page=${pageNumber}`
  console.log(url);
  await page.goto(url);
  
  try {
    const listExists = await page.waitForSelector('ul li', { 
      timeout: 5000 
    }).then(() => true).catch(() => false);
    
    if (!listExists) {
      console.log('No list found on page');
      return [];
    }

    const links = await page.$$eval('ul li a', (anchors) => {
      return anchors.map(anchor => {
        const href = anchor.href;
        const match = href.match(/\/in\/(.*?)\?mini/);
        return match ? match[1] : null;
      }).filter(Boolean);
    });
    
    return [...new Set(links)];
  } catch (error) {
    console.error('Error extracting links:', error);
    return [];
  }
}


async function GoodContact(page, link) {
  try {
    const activityUrl = `https://www.linkedin.com/in/${link}/recent-activity/reactions/`;
    console.log(activityUrl);
    await page.goto(activityUrl);
    let score = 0;
    let scoreHolder = 0;
    let previousScoreHolder = 0;
    let twoLoopsAgoScoreHolder = 0;
    let threeLoopsAgoScoreHolder = 0;
    const recencyValues = { days: recencyDays, hours: recencyHours, weeks: recencyWeeks };
    
    for (let i = 0; i < historyToCheck; i++) {
      await page.waitForSelector('ul li a', { visible: true });
      // Count timeframe mentions
      const counts = await page.evaluate(() => {
         const timeframes = {
            hour: /([1-23]h)\b/i,
          day: /\b([1-6]d)\b/i,
          week: /\b([1-4]w)\b/i
          };
          const elements = document.querySelectorAll('span[aria-hidden="true"]');
          return Object.entries(timeframes).reduce((acc, [key, regex]) => {
            acc[key] = [...elements].filter(el => regex.test(el.textContent?.toLowerCase() ?? '')).length;
            console.log(`${key}:`, acc[key]);
            return acc;
          }, {hour: 0, day: 0, week: 0 });
        });
        if(i === historyToCheck - 1 ){
          score += counts.day * recencyValues.days;
          score += counts.hour * recencyValues.hours;
          score += counts.week * recencyValues.weeks;
        } else {
          threeLoopsAgoScoreHolder = twoLoopsAgoScoreHolder;
          twoLoopsAgoScoreHolder = previousScoreHolder;
          previousScoreHolder = scoreHolder;
          scoreHolder = 0;
          
          scoreHolder += counts.day;
          scoreHolder += counts.hour;
          scoreHolder += counts.week;

          if (i > 1 && scoreHolder === threeLoopsAgoScoreHolder) {
            score += counts.day * recencyValues.days;
            score += counts.hour * recencyValues.hours;
            score += counts.week * recencyValues.weeks;
            break;
          }
        }
       
        
        console.log(`Scroll ${i + 1} - Counts:`, counts);
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
      }

      
  console.log(`score: ${score}`)
    return score >= threshold;
  } catch (error) {
    console.error('Error in GoodContact:', error);
    return false;
  }
}

// The main route to scrape and search
app.post('/', async (req, res) => {
  console.log('Received request body:', req.body);
  const { companyName, companyRole, companyLocation, searchName, searchPassword} = req.body;
  const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const delay = randomInRange(500, 5000);
  const timeout = 5000;
  let browser = null;

 
  try {
    browser = await puppeteer.launch({ headless: false, slowMo: 50,});
    const page = await browser.newPage();
    await page.setViewport({ 
      width: 1200, 
      height: 800,
      deviceScaleFactor: 1,
      isMobile: false 
    });
    
    await page.goto('https://www.linkedin.com/login');
    
    page.setDefaultTimeout(30000000);
    let element = await Promise.race([
        page.locator('::-p-aria(Email or phone)'),
        page.locator('#username'),
        page.locator('::-p-xpath(//*[@id=\\"username\\"])'),
        page.locator(':scope >>> #username')
    ])
        
    await element.click({
          offset: {
            x: 56.5,
            y: 21.5,
          },
        });
    console.log(searchName);
    try {
    const element = await Promise.race([
        page.locator('::-p-aria(Email or phone)'),
        page.locator('#username'),
        page.locator('::-p-xpath(//*[@id=\\"username\\"])'),
        page.locator(':scope >>> #username')
    ])
      await element.fill(searchName);
    } catch (error){
      console.error('Failed to fill username:', error);
    }
          
    await page.keyboard.down('Tab');
    await page.keyboard.up('Tab');
    

    element = await Promise.race([
            page.locator('::-p-aria(Password)'),
            page.locator('#password'),
            page.locator('::-p-xpath(//*[@id=\\"password\\"])'),
            page.locator(':scope >>> #password')
        ])
            
    await element.fill(searchPassword);
    
    element = await Promise.race([
      page.locator('::-p-aria(Sign in[role="button"])'),
      page.locator('form button'),
      page.locator('::-p-xpath(//*[@id="organic-div"]/form/div[4]/button)'),
      page.locator(':scope >>> form button')
  ]);
  
  // Wait for navigation after click
    const navigationPromise = page.waitForNavigation();
    await element.click({
        offset: {
            x: 94.5,
            y: 27.515625,
        }
    });
    await navigationPromise;
    
    element = await Promise.race([
        page.locator('::-p-aria(Search)'),
        page.locator('#global-nav input'),
        page.locator('::-p-xpath(//*[@id=\\"global-nav-typeahead\\"]/input)'),
        page.locator(':scope >>> #global-nav input')
    ])
        
    await element.fill(companyName);
    
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    
    element = await Promise.race([
      page.locator(`::-p-aria(${companyName}[role=\\"link\\"])`),
      page.locator('div.search-nec__hero-kcard-v2-content a'),
      page.locator('::-p-xpath(//*[@id=\\"/76nR2TmThOYqRobQEAgiw==\\"]/div/ul/li/div/div/div/div[1]/div[1]/div/div/span/span/a)'),
      page.locator(':scope >>> div.search-nec__hero-kcard-v2-content a')
    ])
      
    element.click({
        offset: {
          x: 37,
          y: 16,
        },
      });
    element = await Promise.race([
        page.locator('::-p-aria(Organization’s page navigation) >>>> ::-p-aria(Jobs)'),
        page.locator('#ember563'),
        page.locator('::-p-xpath(//*[@id=\\"ember563\\"])'),
        page.locator(':scope >>> #ember563')
    ])
        
    await element.click({
          offset: {
            x: 31.625,
            y: 26,
          },
        });

    element = await Promise.race([
        page.locator('div.org-jobs-recently-posted-jobs-module > div span:nth-of-type(1)'),
        page.locator('::-p-xpath(//*[@id=\\"ember864\\"]/span[1])'),
        page.locator(':scope >>> div.org-jobs-recently-posted-jobs-module > div span:nth-of-type(1)'),
        page.locator('::-p-text(Show all jobs)')
    ])
        
    await element.click({
          offset: {
            x: 54.9375,
            y: 6.546875,
          },
        });
    
    
    
    element = await Promise.race([
            page.locator('::-p-aria(City, state, or zip code)'),
            page.locator('#jobs-search-box-location-id-ember1277'),
            page.locator('::-p-xpath(//*[@id=\\"jobs-search-box-location-id-ember1277\\"])'),
            page.locator(':scope >>> #jobs-search-box-location-id-ember1277')
        ])
      
    await element.click({
        offset: {
          x: 7.6875,
          y: 2,
        },
      });

    element = await Promise.race([
        page.locator('::-p-aria(City, state, or zip code)'),
        page.locator('#jobs-search-box-location-id-ember1205'),
        page.locator('::-p-xpath(//*[@id=\\"jobs-search-box-location-id-ember1205\\"])'),
        page.locator(':scope >>> #jobs-search-box-location-id-ember1205')
    ])
        
    await element.fill(companyLocation);
      
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');

    await page.waitForSelector('ul li a', { visible: true });
    const geoURL = await page.url();
    console.log(geoURL);
    const matchGeo = geoURL.match(/&geoId=(\d+)&/);
    const matchCompany = geoURL.match(/&f_C=(\d+)/);
    let extractedGeoNumber;
    if (matchGeo && matchGeo[1]) {
      extractedGeoNumber = matchGeo[1];
    }
    let extractedCompanyNumber;
    if (matchCompany && matchCompany[1]) {
        extractedCompanyNumber = matchCompany[1];
    }
    console.log(extractedCompanyNumber);
    console.log(extractedGeoNumber);

    const encodedRole = encodeURIComponent(companyRole);
    
    let tempLinksAccumulator = [];
    for (let pageNumber = pageNumberStart; pageNumber <= pageNumberEnd; pageNumber++) {
      const tempLinks = await GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber);
      if (tempLinks.length === 0) {
        console.log('No more links found on page');
        break;
      }
      tempLinksAccumulator.push(...tempLinks);
      try {
        await fs.writeFile(
          './possible-links.txt', 
          JSON.stringify(tempLinksAccumulator, null, 2)
        );
        console.log(`Saved ${tempLinksAccumulator.length} links to file after page ${pageNumber}`);
      } catch (error) {
        console.error('Error writing to file:', error);
      }
    }

    const uniqueLinks = Array.from(new Set(tempLinksAccumulator));

    
    
   
 
  
    const results = [];
    for (const link of uniqueLinks) {
      if (/ACoA/.test(link)) {
        continue;
      }
      const isGoodContact = await GoodContact(page, link);
      if (isGoodContact) {
        results.push(link);
      }

      try {
        await fs.writeFile(
          './good-connection-links.txt', 
          JSON.stringify(results, null, 2)
        );
        console.log(`Saved ${results.length} links to file`);
      } catch (error) {
        console.error('Error writing to file:', error);
      }
    }
    console.log(results)
    // Send the results back to the client
    res.json({ results });
  } catch (error) {
    console.error('Error in the main application:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
    
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
