#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to restore contacts from good-connection-links.json to browser localStorage
 * Run this script and copy the output to your browser's console
 */

try {
  // Read the contacts from the JSON file
  const contactsPath = path.join(__dirname, 'backend', 'data', 'good-connection-links.json');
  const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));

  console.log('// Copy and paste the following code into your browser console:');
  console.log('// This will restore your LinkedIn contacts to localStorage');
  console.log('');
  console.log(`// Adding ${contacts.length} contacts to localStorage`);
  console.log(`localStorage.setItem('searchResults', ${JSON.stringify(JSON.stringify(contacts))});`);
  console.log(`localStorage.setItem('visitedLinks', '{}');`);
  console.log(`console.log('Successfully restored ${contacts.length} contacts to localStorage');`);
  console.log(`console.log('Refresh the page to see the contacts in your app');`);

} catch (error) {
  console.error('Error reading contacts file:', error.message);
  console.error('Make sure the file backend/data/good-connection-links.json exists');
  process.exit(1);
}