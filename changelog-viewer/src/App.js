import React, { useState } from 'react';
import changelogData from './changelog.json';

// Platform-specific changelog URLs
const CHANGELOG_URLS = {
  YouTube: 'https://developers.google.com/youtube/v3/revision_history',
  Meta: 'https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes'
};

// Type-specific colors
const TYPE_COLORS = {
  'Feature Update': 'bg-blue-100 text-blue-800',
  'API Update': 'bg-green-100 text-green-800',
  'Deprecation': 'bg-red-100 text-red-800'
};



function App() {
  const [data] = useState(changelogData);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState({
    platform: '',
    type: '',
    startDate: '',
    endDate: ''
  });
  
  const [isScrapingInProgress, setIsScrapingInProgress] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState(null);

  const runScraper = async () => {
    setIsScrapingInProgress(true);
    setLastUpdateError(null);
    
    try {
      const response = await fetch('http://localhost:3001/run-scraper', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to run scraper');
      }
      
      const updatedData = await response.json();
      
      // Reload the current data with new changes
      window.location.reload();
    } catch (error) {
      setLastUpdateError(error.message);
      console.error('Error running scraper:', error);
    } finally {
      setIsScrapingInProgress(false);
    }
  };

  // Sorting handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter the data
  const filteredData = data.changes.filter(item => {
    const matchesPlatform = !filters.platform || item.platform === filters.platform;
    const matchesType = !filters.type || item.type === filters.type;
    
    // Date range filtering
    const itemDate = new Date(item.date);
    const matchesDate = (!filters.startDate || itemDate >= new Date(filters.startDate)) && 
                       (!filters.endDate || itemDate <= new Date(filters.endDate));
    
    return matchesPlatform && matchesType && matchesDate;
  });

  // Sort the filtered data
  const sortedData = filteredData.sort((a, b) => {
    if (sortConfig.key === 'date') {
      const dateA = new Date(a[sortConfig.key]);
      const dateB = new Date(b[sortConfig.key]);
      if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    } else {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
  });

  // Get unique values for filters
  const getUniqueValues = (key) => {
    const values = new Set(data.changes.map(item => item[key]));
    return Array.from(values);
  };

  // Remove duplicate links
  const getUniqueLinks = (links) => {
    const seen = new Set();
    return links.filter(link => {
      const key = `${link.text}${link.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Function to convert data to CSV and download
  // Function to convert data to CSV and download
const exportToCSV = () => {
  // Define columns for export
  const columns = [
    'Announcement Date',
    'Platform',
    'Type',
    'Impacted Module',
    'Description',
    'Links'
  ];

  // Convert the filtered data to CSV format
  const csvData = sortedData.map(change => {
    // Combine all links into one cell
    const links = [
      CHANGELOG_URLS[change.platform], // Announcement link
      ...(change.links || []).map(link => link.url) // Other links
    ].join(', ');

    // Format the description: title + description + endpoints + more details
    const fullDescription = [
      change.title,
      change.description,
      change.endpoints?.map(e => `${e.method} ${e.path}`).join('\n'),
      change.details?.length > 0 ? 'Additional Details:' : null,
      change.details?.map(detail => `• ${detail}`).join('\n')
    ].filter(Boolean).join('\n\n');

    return [
      new Date(change.date).toLocaleDateString(),
      change.platform,
      change.type,
      '', // Impacted Module (currently empty)
      fullDescription,
      links
    ].map(cell => `"${(cell || '').replace(/"/g, '""')}"`) // Escape quotes and wrap in quotes
    .join(',');
  });

  // Add header row
  const csv = [
    columns.map(col => `"${col}"`).join(','),
    ...csvData
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `changelog_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-full mx-2 py-6 px-4">
        <div className="py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            API Changelog Manager
          </h1>
          
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    All Changes
                  </h2>
                  <p className="text-sm text-gray-500">
                    Last updated: {new Date(data.last_updated).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Total changes: {data.metadata.total_changes}
                  </div>
                  <button
                    onClick={() => runScraper()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2"
                  >
                    {isScrapingInProgress ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      'Update Changelog'
                    )}
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Export to CSV
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 flex gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Platform</label>
                  <select
                    className="mt-1 block w-40 rounded-md text-sm"
                    value={filters.platform}
                    onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                  >
                    <option value="">All Platforms</option>
                    {getUniqueValues('platform').map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    className="mt-1 block w-40 rounded-md text-sm"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="">All Types</option>
                    {getUniqueValues('type').map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Announcement Date Range</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        className="mt-1 block w-40 rounded-md text-sm"
                        value={filters.startDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setFilters(prev => ({
                            ...prev,
                            startDate: newDate,
                            // If end date exists and is before new start date, update it
                            endDate: prev.endDate && new Date(prev.endDate) < new Date(newDate) 
                              ? newDate 
                              : prev.endDate
                          }));
                        }}
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        className="mt-1 block w-40 rounded-md text-sm"
                        value={filters.endDate}
                        min={filters.startDate} // Prevent selecting end date before start date
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            endDate: e.target.value
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => requestSort('date')}
                    >
                      Announcement Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => requestSort('platform')}
                    >
                      Platform {sortConfig.key === 'platform' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => requestSort('type')}
                    >
                      Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impacted Module
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Related Links
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedData.map((change, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(change.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {change.platform}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-sm ${TYPE_COLORS[change.type]}`}>
                          {change.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Empty for now */}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {/* Title */}
                          <h4 className="font-medium text-gray-900">
                            {change.title}
                          </h4>
                          
                          {/* Description */}
                          <p className="text-gray-600">
                            {change.description}
                          </p>
                          
                          {/* Endpoints (if available) */}
                          {change.endpoints?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-sm text-gray-600 cursor-pointer font-medium hover:text-gray-900">
                                View Endpoints
                              </summary>
                              <div className="mt-2 space-y-1 ml-4">
                                {change.endpoints.map((endpoint, idx) => (
                                  <div key={idx} className="text-sm font-mono bg-gray-50 p-1 rounded">
                                    {endpoint.method} {endpoint.path}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          
                          {/* Additional Details (if available) */}
                          {change.details?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-sm text-gray-600 cursor-pointer font-medium hover:text-gray-900">
                                More Details
                              </summary>
                              <ul className="mt-2 space-y-1 ml-4">
                                {change.details.map((detail, idx) => (
                                  <li key={idx} className="text-sm text-gray-600">• {detail}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-4">
                          {/* Announcement Link */}
                          <a
                            href={CHANGELOG_URLS[change.platform]}
                            className="text-blue-600 hover:text-blue-800 block font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View announcement here
                          </a>
                          
                          {/* Separator only if there are other links */}
                          {getUniqueLinks(change.links).length > 0 && (
                            <div className="border-b border-gray-200"></div>
                          )}
                          
                          {/* Other Related Links */}
                          <div className="space-y-1">
                            {getUniqueLinks(change.links).map((link, idx) => (
                              <a
                                key={idx}
                                href={link.url}
                                className="text-blue-600 hover:text-blue-800 block"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {link.text || 'Learn more'}
                              </a>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;