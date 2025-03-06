import React, { useEffect, useState } from 'react';
import axios from 'axios';

const DataTable = ({ title, headers, data }) => (
  <div className="mb-6 bg-white shadow-md rounded-lg overflow-hidden">
    <h3 className="text-lg font-semibold bg-gray-200 p-4">{title}</h3>
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            {headers.map((header, index) => (
              <th key={index} className="py-3 px-4 border-b text-left">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 transition duration-200">
              {headers.map((header, cellIndex) => (
                <td key={cellIndex} className="py-2 px-4 border-b text-gray-700">
                  {row[header.toLowerCase().replace(/ /g, '_')] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Dash = () => {
  const [compressiveData, setCompressiveData] = useState([]);
  const [shearData, setShearData] = useState([]);
  const [flexureData, setFlexureData] = useState([]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  useEffect(() => {
    axios.get(`${apiBaseUrl}/compressive-data`)
      .then(response => setCompressiveData(response.data))
      .catch(error => console.error('Failed to fetch compressive data:', error));

    axios.get(`${apiBaseUrl}/shear-data`)
      .then(response => setShearData(response.data))
      .catch(error => console.error('Failed to fetch shear data:', error));

    axios.get(`${apiBaseUrl}/flexure-data`)
      .then(response => setFlexureData(response.data))
      .catch(error => console.error('Failed to fetch flexure data:', error));
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      <p className="mt-2 text-gray-600">Welcome to the dashboard! Here you can find various test results.</p>

      {/* Compressive Test Table */}
      <DataTable
        title="Compressive Test Results"
        headers={['ID', 'Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load']}
        data={compressiveData}
      />

      {/* Shear Test Table */}
      <DataTable
        title="Shear Test Results"
        headers={['ID', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load']}
        data={shearData}
      />

      {/* Flexure Test Table */}
      <DataTable
        title="Flexure Test Results"
        headers={['ID', 'Specimen Name', 'Width', 'Height', 'Area', 'Moisture Content', 'Max Force Load']}
        data={flexureData}
      />
    </div>
  );
};

export default Dash;
