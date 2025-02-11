import { useState } from 'react';
import Search from './Search';

const App = () => {
  const [companyName, setCompanyName] = useState('');
  const [companyRole, setCompanyRole] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Optional: Update companyName, companyRole, and companyLocation through user input
  const handleCompanyNameChange = (event) => setCompanyName(event.target.value);
  const handleCompanyRoleChange = (event) => setCompanyRole(event.target.value);
  const handleCompanyLocationChange = (event) => setCompanyLocation(event.target.value);

  return (
    <div>
      <h1>Company Search</h1>

      {/* Input fields for company name, role, and location */}
      <div>
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
      </div>

      {/* Search component */}
      <Search
        companyName={companyName}
        companyRole={companyRole}
        companyLocation={companyLocation}
        setSearchResults={setSearchResults}
      />

      {/* Display search results */}
      <div>
        <h3>Search Results:</h3>
        {searchResults.length === 0 ? (
          <p>No results found.</p>
        ) : (
          <ul>
            {searchResults.map((result, index) => (
              <li key={index}>{result}</li>  
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default App;
