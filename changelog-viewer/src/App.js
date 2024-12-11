import React, { useState } from 'react';
import changelogData from './changelog.json';

function App() {
  const [data] = useState(changelogData);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState({
    platform: '',
    type: ''
  });
  
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
  return (
    (!filters.platform || item.platform === filters.platform) &&
    (!filters.type || item.type === filters.type)
  );
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

return (
  <div className="min-h-screen bg-gray-100">
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          API Changelog
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
              <div className="text-sm text-gray-500">
                Total changes: {data.metadata.total_changes}
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 flex gap-4">
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
                    Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoints
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Links
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
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
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        change.flags.is_deprecation ? 'bg-red-100 text-red-800' : 
                        change.flags.is_breaking_change ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {change.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {change.title}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {change.endpoints?.map((endpoint, idx) => (
                          <div key={idx} className="text-sm font-mono bg-gray-100 p-1 rounded">
                            {endpoint.method} {endpoint.path}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {change.links?.map((link, idx) => (
                          <a
                            key={idx}
                            href={link.url}
                            className="text-blue-600 hover:text-blue-800 block"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.text}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p>{change.description}</p>
                        {change.details?.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm text-gray-600 cursor-pointer">
                              More details
                            </summary>
                            <ul className="mt-2 list-disc list-inside">
                              {change.details.map((detail, idx) => (
                                <li key={idx} className="text-sm text-gray-600">{detail}</li>
                              ))}
                            </ul>
                          </details>
                        )}
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