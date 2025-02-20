import { useState } from 'react';
import Search from './Search';

const App = () => {
  const [companyName, setCompanyName] = useState('');
  const [companyRole, setCompanyRole] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPassword, setSearchPassword] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Optional: Update companyName, companyRole, and companyLocation through user input
  const handleCompanyNameChange = (event) => setCompanyName(event.target.value);
  const handleCompanyRoleChange = (event) => setCompanyRole(event.target.value);
  const handleCompanyLocationChange = (event) => setCompanyLocation(event.target.value);
  const handleSearchUserNameChange = (event) => setSearchName(event.target.value);
  const handleSearchPasswordChange = (event) => setSearchPassword(event.target.value);

  return (
    <div style={{margin: 5 + 'em'}}>
      <h1>Company Search</h1>

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
              <li key={index}>{result}</li>  
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default App;
