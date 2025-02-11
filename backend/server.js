import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const port = 3001;


app.use(express.json());

async function GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber) {
  await page.goto(`https://www.linkedin.com/search/results/people/?currentCompany=%5B%22getByRole{extractedCompanyNumber}%22%5D&geoUrn=%5B%22getByRole{extractedGeoNumber}%22%5D&keywords=getByRole{encodedRole}&origin=FACETED_SEARCH&page=getByRole{pageNumber}`);
  
  const hasResults = await page.evaluate(() => {
      return document.querySelector('.search-results-container') !== null;
  });

  if (!hasResults) {
      return null;
  }
  
  const links = await page.evaluate(() => {
      const anchorTags = document.querySelectorAll('ul > li > a');
      return Array.from(anchorTags).map(anchor => {
          const match = anchor.href.match(/\/in\/(.*?)\?mini/);
          return match ? match[1] : null;
      }).filter(Boolean);
  });
  
  const uniqueLinks = [...new Set(links)];
  return uniqueLinks;
}

async function GoodContact(page, link) {
  try {
    const activityUrl = `https://www.linkedin.com/in/${link}/recent-activity/reactions/`;
    await page.goto(activityUrl);

    const recencyValues = { days: 5, hours: 10, weeks: 1 };
    let score = 0;
    const threshold = 50;

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight)); // Scroll
      await page.waitForTimeout(1000); // Wait for loading new content

      const counts = await page.evaluate(() => {
        const timeframes = ['day', 'hour', 'week'];
        const elements = [...document.querySelectorAll('a')];
        const count = timeframes.reduce((acc, timeframe) => {
          acc[timeframe] = elements.filter(el => el.textContent?.includes(timeframe)).length;
          return acc;
        }, {});
        return count;
      });

      score += (counts['day'] ?? 0) * recencyValues['days'];
      score += (counts['hour'] ?? 0) * recencyValues['hours'];
      score += (counts['week'] ?? 0) * recencyValues['weeks'];
    }

    return score >= threshold;
  } catch (error) {
    console.error('Error in GoodContact:', error);
    return false;
  }
}

// The main route to scrape and search
app.post('/search', async (req, res) => {
  const { companyName, companyRole, companyLocation } = req.body;

  let browser = null;
  let page = null;

  try {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();

    await page.goto('https://www.linkedin.com/');
    // Email field
    await page.$eval('input[type="text"][aria-label="Email or phone"]', item => item.click());
    await page.$eval('input[type="text"][aria-label="Email or phone"]', (item, value) => item.value = value, 'your-email@example.com');
    await page.keyboard.press('Tab');

    await page.$eval('input[type="password"][aria-label="Password"]', (item, value) => item.value = value, 'your-password');

    await page.$eval('button[aria-label="Sign in"]', button => button.click());

    await page.$eval('input[role="combobox"][aria-label="Search"]', item => item.click());
    await page.$eval('input[role="combobox"][aria-label="Search"]', (item, value) => item.value = value, companyName);
    await page.keyboard.press('Enter');

    await page.$eval('a[aria-label="Company Name"]:first-of-type', link => link.click());
    const jobsLink = await page.$('[aria-label="Organization\'s page navigation"] a:has-text("Jobs")');
    await jobsLink.click();
    await page.$eval('a[aria-label="Click to See all jobs at"]', link => link.click());
    const companyURL = await page.url();
    const matchCompany = companyURL.match(/&f_C=(\d{4,9})%/);
    let extractedCompanyNumber;
    if (matchCompany && matchCompany[1]) {
      extractedCompanyNumber = matchCompany[1];
    }

    await page.$eval('button[aria-label="Clear search location"]', button => button.click());
    await page.$eval('input[role="combobox"][aria-label="City, state, or zip code"]', (item, value) => item.value = value, companyLocation);
    await page.keyboard.press('Enter');
    const geoURL = await page.url();
    const matchGeo = geoURL.match(/&geoId=(\d{4,15})&/);
    let extractedGeoNumber;
    if (matchGeo && matchGeo[1]) {
      extractedGeoNumber = matchGeo[1];
    }

    const encodedRole = encodeURIComponent(companyRole);

    let tempLinksAccumulator = [];
    for (let pageNumber = 1; pageNumber <= 2; pageNumber++) {
      const tempLinks = await GetLinks(page, pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber);
      if (!tempLinks) {
        break;
      }
      tempLinksAccumulator.push(...tempLinks);
    }

    const uniqueLinks = Array.from(new Set(tempLinksAccumulator));
    
    const results = [];
    for (const link of uniqueLinks) {
      const isGoodContact = await GoodContact(page, link);
      if (isGoodContact) {
        results.push(link);
      }
    }

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
