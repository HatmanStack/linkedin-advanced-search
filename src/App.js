import { useState, useEffect } from 'react';
import Search from './Search';

const App = () => {
  const [companyName, setCompanyName] = useState('');
  const [companyRole, setCompanyRole] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPassword, setSearchPassword] = useState('');
  const [visitedLinks, setVisitedLinks] = useState({});
  //const [getResponse, setGetResponse] = useState('');
  //const [response, setResponse] = useState(['']);
  const [searchResults, setSearchResults] = useState([

  ]);

  useEffect(() => {
    // Load visited links from local storage on component mount
    const storedVisitedLinks = localStorage.getItem('visitedLinks');
    if (storedVisitedLinks) {
      setVisitedLinks(JSON.parse(storedVisitedLinks));
    }
  }, []);

  const handleLinkClick = (result, event) => {
    // Update visitedLinks state when a link is clicked
    
    setVisitedLinks(prevVisitedLinks => {
      const updatedVisitedLinks = { ...prevVisitedLinks, [result]: true };
      // Save updated visitedLinks to local storage
      localStorage.setItem('visitedLinks', JSON.stringify(updatedVisitedLinks));
      return updatedVisitedLinks;
    });
  
  };

  const handleContextMenu = (result, event) => {
    console.log('Context Menu clicked:', result);
    

    // Update visitedLinks state on right click
    setVisitedLinks(prevVisitedLinks => {
      const updatedVisitedLinks = { ...prevVisitedLinks, [result]: true };
      // Save updated visitedLinks to local storage
      localStorage.setItem('visitedLinks', JSON.stringify(updatedVisitedLinks));
      return updatedVisitedLinks;
    });
  };

  // Optional: Update companyName, companyRole, and companyLocation through user input
  const handleCompanyNameChange = (event) => setCompanyName(event.target.value);
  const handleCompanyRoleChange = (event) => setCompanyRole(event.target.value);
  const handleCompanyLocationChange = (event) => setCompanyLocation(event.target.value);
  const handleSearchUserNameChange = (event) => setSearchName(event.target.value);
  const handleSearchPasswordChange = (event) => setSearchPassword(event.target.value);
  //const handleGetResponse = (event) => setGetResponse(event.target.value);

  return (
    <div style={{margin: 5 + 'em'}}>
      <h1>LinkedIn Advanced Search</h1>

      {/* Input fields for company name, role, and location */}
      <div >
        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={handleCompanyNameChange}
        />
        <input
          type="text"
          placeholder="Company Role"
          value={companyRole}
          onChange={handleCompanyRoleChange}
        />
        <input
          type="text"
          placeholder="Company Location"
          value={companyLocation}
          onChange={handleCompanyLocationChange}
        />
        <input
          type="text"
          placeholder="Search UserName"
          value={searchName}
          onChange={handleSearchUserNameChange}
        />
        <input
          type="text"
          placeholder="Search Password"
          value={searchPassword}
          onChange={handleSearchPasswordChange}
        />
        {/** 
        <input
          type="text"
          placeholder="Get Response Leave Blank if not needed"
          value={getResponse}
          onChange={handleGetResponse}
        />*/}

      </div>

      {/* Search component */}
      <Search
        companyName={companyName}
        companyRole={companyRole}
        companyLocation={companyLocation}
        searchName={searchName}
        searchPassword={searchPassword}
        setSearchResults={setSearchResults}
        
      />

      {/* Display search results */}
      <div >
        <h3>Search Results:</h3>
        {searchResults.length === 0 ? (
          <p>No results found.</p>
        ) : (
          <ul>
           {searchResults.map((result, index) => (
              <li key={index}>
                <a
                  href={`https://www.linkedin.com/in/${result}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: visitedLinks[result] ? 'red' : 'blue' }} // Change color based on visited state
                  onClick={(event) => handleLinkClick(result, event)} // Track left link clicks
                  onContextMenu={(event) => handleContextMenu(result, event)} >
                {result}
                </a>
              </li>  
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default App;
