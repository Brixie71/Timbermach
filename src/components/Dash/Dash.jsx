import React from 'react';

// Sample data for the tables (you can replace this with real data)
const compressiveData = [
  { name: 'Specimen 1', width: 10, height: 20, length: 30, area: 600, moistureContent: 12, maxForceLoad: 15, photo: null },
  // Add more data as needed
];

const shearData = [
  { name: 'Specimen 2', width: 10, height: 20, length: 30, area: 600, moistureContent: 10, maxForceLoad: 18, photo: null },
  // Add more data as needed
];

const flexureData = [
  { name: 'Specimen 3', width: 10, height: 20, length: 30, area: 600, moistureContent: 14, maxForceLoad: 20, photo: null },
  // Add more data as needed
];

const woodMoistureData = [
  { name: 'Specimen 4', moistureContent: 15, photo: null },
  // Add more data as needed
];

const measurementData = [
  { name: 'Specimen 5', width: 10, height: 20, length: 30, area: 600, photo: null },
  // Add more data as needed
];

// Table component to render individual tables
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
              {Object.values(row).map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2 px-4 border-b text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Dash = () => {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      <p className="mt-2 text-gray-600">Welcome to the dashboard! Here you can find various test results.</p>

      {/* Compressive Test Table */}
      <DataTable
        title="Compressive Test Results"
        headers={['Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load (kN)', 'Photo']}
        data={compressiveData}
      />

      {/* Shear Test Table */}
      <DataTable
        title="Shear Test Results"
        headers={['Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load (kN)', 'Photo']}
        data={shearData}
      />

      {/* Flexure Test Table */}
      <DataTable
        title="Flexure Test Results"
        headers={['Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Moisture Content', 'Max Force Load (kN)', 'Photo']}
        data={flexureData}
      />

      {/* Wood Moisture Table */}
      <DataTable
        title="Wood Moisture Content"
        headers={['Specimen Name', 'Moisture Content', 'Photo']}
        data={woodMoistureData}
      />

      {/* Measurement Table */}
      <DataTable
        title="Measurement Results"
        headers={['Specimen Name', 'Width', 'Height', 'Length', 'Area', 'Photo']}
        data={measurementData}
      />
    </div>
  );
};

export default Dash;