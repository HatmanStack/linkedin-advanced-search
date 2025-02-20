import { useState } from 'react';

const Search = ({ companyName, companyRole, companyLocation, searchName, searchPassword, setSearchResults }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callLambda = async () => {
    try {
      setLoading(true);
      console.log(companyName);
     
      const payload = {
        companyName,
        companyRole,
        companyLocation,
        searchName,
        searchPassword
      };
      //const apiUrl = 'https://your-api-gateway-url.amazonaws.com/your-lambda-function-endpoint';
      
      const apiUrl = 'http://localhost:3001/';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Something went wrong while calling Lambda');
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);  
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger the search when necessary
  const handleSearch = () => {
    if (companyName || companyRole || companyLocation || searchName || searchPassword) {
      callLambda();
    }
  };

  return (
    <div>
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      {error && <div className="error">{error}</div>}
   
    </div>
    );
};

export default Search;