import express from 'express';
import Promise from 'Promise';
import puppeteer from 'puppeteer';
import { useState } from 'react';

const app = express();
const port = 3001;


app.use(express.json());

async function GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber) {
 await page.goto(`https://www.linkedin.com/search/results/people/?currentCompany=%5B"${extractedCompanyNumber}"%5D&geoUrn=%5B"${extractedGeoNumber}"%5D&keywords=${encodedRole}&origin=FACETED_SEARCH&page=${pageNumber}`);
  
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
    const recencyValues = { days: 5, hours: 10, weeks: 1 };
    const threshold = 50;
    const scrollAttempts = 5;
    let counts = { hour: 0, day: 0, week: 0 };

for (let i = 0; i < scrollAttempts; i++) {
  console.log('test');
  await page.waitForSelector('ul li a', { visible: true });
  console.log('test1');
  
  // Count timeframe mentions
  const newCounts = await page.evaluate(() => {
      const timeframes = {
        hour: /(hour|hr|h)\b/i,
        day: /\b(day|d)\b/i,
        week: /\b(week|wk|w)\b/i
      };
      const elements = document.querySelectorAll('span[aria-hidden="true"]');
      return Object.entries(timeframes).reduce((acc, [key, regex]) => {
        acc[key] = [...elements].filter(el => regex.test(el.textContent?.toLowerCase() ?? '')).length;
        return acc;
      }, {});
    });
    counts.hour += newCounts.hour ?? 0;
    counts.day += newCounts.day ?? 0;
    counts.week += newCounts.week ?? 0;
    
    console.log(`Scroll ${i + 1} - Counts:`, counts, 'Current Score:', score);
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
  }

  score += counts.day * recencyValues.days;
  score += counts.hour * recencyValues.hours;
  score += counts.week * recencyValues.weeks;

    return score >= threshold;
  } catch (error) {
    console.error('Error in GoodContact:', error);
    return false;
  }
}

// The main route to scrape and search
app.get('/', async (req, res) => {
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
    
    page.setDefaultTimeout(1000000);
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
    
    try {
    const element = await Promise.race([
        page.locator('::-p-aria(Email or phone)'),
        page.locator('#username'),
        page.locator('::-p-xpath(//*[@id=\\"username\\"])'),
        page.locator(':scope >>> #username')
    ])
      await element.fill('cjgall66@gmail.com');
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
            
    await element.fill('record6699');
    
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
        
    await element.fill('Microsoft');
    /** 
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    
    element = await Promise.race([
      page.locator('::-p-aria(Microsoft[role=\\"link\\"])'),
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
        
    await element.fill('Seattle');
        
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');

    const geoURL = await page.url();
    const matchGeo = geoURL.match(/&geoId=(\d{4,15})&/);
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

    const encodedRole = encodeURIComponent('Recruiter');
    /** 
    let tempLinksAccumulator = [];
    for (let pageNumber = 1; pageNumber <= 1; pageNumber++) {
      const tempLinks = await GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber);
      if (!tempLinks) {
        break;
      }
      tempLinksAccumulator.push(...tempLinks);
    }

    const uniqueLinks = Array.from(new Set(tempLinksAccumulator));
    console.log(uniqueLinks)
    */
   const uniqueLinks = [
    'toni-brown-bell',
    'hillary-lundberg',
    'alexandertbh',
    'kadra-sheikh-mba-hr-6855bb13a',
    'ACoAACHnpQUBzCWtwmxlcevtvYte9t1DVVwjn5Y',
    'hunter-baker-a357767b',
    'rubalvirdi',
    'johnpersem',
    'matt-orrange-37995756'
  ]
    const results = [];
    for (const link of uniqueLinks) {
      const isGoodContact = await GoodContact(page, link);
      if (isGoodContact) {
        results.push(link);
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
