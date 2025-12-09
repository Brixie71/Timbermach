import React, { useState, useEffect } from 'react';

const TestSummary = ({ 
  testData,           
  onRetakeMoisture,
  onRetakeMeasurement,
  onRetakeStrength,
  onSaveAndFinish,
  onBackToMenu
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extract data with fallbacks
  const testType = testData?.testType || '';
  const subType = testData?.subType || '';
  const specimenName = testData?.specimenName || '';
  const moistureData = testData?.moistureData || null;
  const measurementData = testData?.measurementData || null;
  const strengthData = testData?.strengthData || null;

  // Debug log on mount
  useEffect(() => {
    console.log('TestSummary mounted with data:', {
      testType,
      subType,
      specimenName,
      hasMoisture: !!moistureData,
      hasMeasurement: !!measurementData,
      hasStrength: !!strengthData
    });
  }, []);

  // Calculate stress
  const calculateStress = () => {
    if (!measurementData || !strengthData) {
      console.log('Cannot calculate stress: missing data');
      return null;
    }

    if (!measurementData.areaMM2 || !strengthData.maxForce) {
      console.log('Cannot calculate stress: missing required fields');
      return null;
    }

    const area = measurementData.areaMM2; // mm²
    const maxForceN = strengthData.maxForce * 1000; // Convert kN to N
    
    let stress = 0;

    if (!testType || typeof testType !== 'string') {
      console.log('Cannot calculate stress: invalid testType');
      return null;
    }
    
    try {
      const baseTestType = testType.toLowerCase().replace(' test', '').trim();
      
      if (baseTestType === 'compressive') {
        // σ = P/A where P is force (N) and A is area (mm²)
        stress = maxForceN / area;
        
      } else if (baseTestType === 'shear') {
        if (!measurementData.width || !measurementData.length) {
          console.log('Cannot calculate shear stress: missing dimensions');
          return null;
        }
        
        if (subType === 'single') {
          const shearArea = measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        } else if (subType === 'double') {
          const shearArea = 2 * measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        } else {
          // Default to single shear if subType not specified
          const shearArea = measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        }
        
      } else if (baseTestType === 'flexure') {
        if (!measurementData.width || !measurementData.height) {
          console.log('Cannot calculate flexure stress: missing dimensions');
          return null;
        }
        
        const P = maxForceN;
        const L = measurementData.length || 800; // Default span if not provided
        const b = measurementData.width;
        const h = measurementData.height;
        
        // Flexural stress (Modulus of Rupture): f = (M * c) / I
        // For 3-point bending: M = (P * L) / 4
        // Section modulus: S = (b * h²) / 6
        // Therefore: f = (P * L) / (b * h² / 6) = (6 * P * L) / (b * h²)
        const M = (P * L) / 4;
        stress = (6 * M) / (b * h * h);
      }

      return stress;
    } catch (err) {
      console.error('Error calculating stress:', err);
      return null;
    }
  };

  const stress = calculateStress();
  
  // Calculate pressure (same as max force in N/mm²)
  const calculatePressure = () => {
    if (!strengthData?.maxForce || !measurementData?.areaMM2) {
      return null;
    }
    const maxForceN = strengthData.maxForce * 1000; // Convert kN to N
    return maxForceN / measurementData.areaMM2; // N/mm²
  };
  
  const pressure = calculatePressure();

  // ✅ FIXED: Prepare data WITHOUT sub_type field
  const prepareDataForDatabase = () => {
    if (!testType || typeof testType !== 'string') {
      console.error('Cannot prepare data: invalid testType');
      return null;
    }
    
    try {
      const baseTestType = testType.toLowerCase().replace(' test', '').trim();
      
      // Create full test_type string (e.g., "Single Shear", "Parallel to Grain")
      let fullTestType = baseTestType;
      if (subType) {
        if (baseTestType === 'shear') {
          fullTestType = `${subType.charAt(0).toUpperCase() + subType.slice(1)} Shear`;
        } else if (baseTestType === 'compressive') {
          fullTestType = `${subType.charAt(0).toUpperCase() + subType.slice(1)} to Grain`;
        } else if (baseTestType === 'flexure') {
          fullTestType = 'Three Point Bending';
        }
      }
      
      // ✅ Match EXACT field names from your database schema - NO sub_type
      const dbData = {
        test_type: fullTestType,                           // Store full type in test_type
        specimen_name: specimenName || 'Unnamed Specimen',
        base: measurementData?.width || 0,
        height: measurementData?.height || 0,
        length: measurementData?.length || 0,
        area: measurementData?.areaMM2 || 0,
        pressure: pressure || null,
        moisture_content: moistureData?.value || null,
        max_force: strengthData?.maxForce || 0,
        stress: stress || null,
        species_id: null,
        photo: null,
      };
      
      console.log('Prepared database data:', dbData);
      return dbData;
    } catch (err) {
      console.error('Error preparing database data:', err);
      return null;
    }
  };

  // Use correct endpoint matching your table names
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const dbData = prepareDataForDatabase();
      
      if (!dbData) {
        throw new Error('Failed to prepare test data');
      }
      
      // Validate required fields
      if (!dbData.specimen_name) {
        throw new Error('Specimen name is required');
      }
      if (!dbData.max_force) {
        throw new Error('Strength test data is missing');
      }
      if (!dbData.test_type) {
        throw new Error('Test type is required');
      }

      const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      
      // Determine base test type for endpoint
      const baseTestType = testType.toLowerCase().replace(' test', '').trim();
      const endpoint = `${LARAVEL_API_URL}/api/${baseTestType}-data`;
      
      console.log('💾 Saving to database:', endpoint);
      console.log('📦 Data payload:', dbData);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(dbData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          
          // Show specific validation errors if available
          if (errorData.errors) {
            const errorMessages = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
              .join('\n');
            throw new Error(`Validation errors:\n${errorMessages}`);
          }
          
          throw new Error(errorData.message || `Server error: ${response.status}`);
        } catch (parseErr) {
          throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 200)}`);
        }
      }

      const result = await response.json();
      console.log('✅ Save successful:', result);
      
      setSaveSuccess(true);
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('❌ Save failed:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-gray-900">
      {/* Header Bar */}
      <div className="flex items-center px-3 py-1.5 bg-gray-800 fixed top-0 left-0 right-0 z-10">
        <span className="ml-4 text-gray-100 text-lg font-semibold">
          TimberMach | Test Summary
        </span>
        <button
          type="button"
          onClick={onBackToMenu}
          className="bg-transparent border-none text-gray-200 text-2xl cursor-pointer p-1.5 ml-auto hover:text-red-500 transition-colors duration-300"
        >
          ✕
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-12 flex-grow overflow-auto p-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-6 text-center">
            Test Complete - Summary
          </h1>

          {/* Success Message */}
          {saveSuccess && (
            <div className="bg-green-900 border border-green-700 text-green-200 px-6 py-4 rounded-lg mb-6 animate-pulse">
              <strong>✅ Success!</strong> Test data saved successfully to database!
            </div>
          )}

          {/* Error Message */}
          {saveError && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-6 py-4 rounded-lg mb-6">
              <strong>❌ Error:</strong>
              <pre className="mt-2 text-sm whitespace-pre-wrap">{saveError}</pre>
            </div>
          )}

          {/* Test Info */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Test Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-sm">Test Type</div>
                <div className="text-white text-xl font-semibold">{testType}</div>
              </div>
              {subType && (
                <div>
                  <div className="text-gray-400 text-sm">Sub Type</div>
                  <div className="text-white text-xl font-semibold">{subType}</div>
                </div>
              )}
              <div className="col-span-2">
                <div className="text-gray-400 text-sm">Specimen Name</div>
                <div className="text-white text-xl font-semibold">{specimenName || 'Not set'}</div>
              </div>
            </div>
          </div>

          {/* Moisture Content */}
          {moistureData && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <h2 className="text-2xl font-bold text-white">✓ Moisture Content</h2>
                </div>
                {onRetakeMoisture && (
                  <button
                    onClick={onRetakeMoisture}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    🔄 Retake
                  </button>
                )}
              </div>
              <div className="bg-blue-900 bg-opacity-30 rounded-lg p-6 border border-blue-700 text-center">
                <div className="text-6xl font-bold text-white mb-2">
                  {moistureData.value}%
                </div>
                <div className="text-gray-400 text-xs">
                  {moistureData.timestamp ? new Date(moistureData.timestamp).toLocaleString() : 'Just completed'}
                </div>
              </div>
            </div>
          )}

          {/* Dimension Measurement */}
          {measurementData && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <h2 className="text-2xl font-bold text-white">✓ Dimension Measurement</h2>
                </div>
                {onRetakeMeasurement && (
                  <button
                    onClick={onRetakeMeasurement}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    🔄 Retake
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-900 bg-opacity-30 rounded-lg p-4 border border-red-700">
                  <div className="text-red-400 text-sm mb-1">Width (Base)</div>
                  <div className="text-white text-2xl font-bold">
                    {measurementData.width?.toFixed(2)} mm
                  </div>
                  <div className="text-gray-300 text-sm mt-1">
                    {(measurementData.width / 25.4).toFixed(3)}"
                  </div>
                </div>

                <div className="bg-green-900 bg-opacity-30 rounded-lg p-4 border border-green-700">
                  <div className="text-green-400 text-sm mb-1">Height</div>
                  <div className="text-white text-2xl font-bold">
                    {measurementData.height?.toFixed(2)} mm
                  </div>
                  <div className="text-gray-300 text-sm mt-1">
                    {(measurementData.height / 25.4).toFixed(3)}"
                  </div>
                </div>

                <div className="bg-purple-900 bg-opacity-30 rounded-lg p-4 border border-purple-700">
                  <div className="text-purple-400 text-sm mb-1">Area</div>
                  <div className="text-white text-2xl font-bold">
                    {measurementData.areaMM2?.toFixed(2)} mm²
                  </div>
                  <div className="text-gray-300 text-sm mt-1">
                    {(measurementData.areaMM2 / 645.16).toFixed(3)} in²
                  </div>
                </div>

                {measurementData.length && (
                  <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4 border border-blue-700">
                    <div className="text-blue-400 text-sm mb-1">Length</div>
                    <div className="text-white text-2xl font-bold">
                      {measurementData.length?.toFixed(2)} mm
                    </div>
                    <div className="text-gray-300 text-sm mt-1">
                      {(measurementData.length / 25.4).toFixed(3)}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Strength Test */}
          {strengthData && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <h2 className="text-2xl font-bold text-white">✓ Strength Test</h2>
                </div>
                {onRetakeStrength && (
                  <button
                    onClick={onRetakeStrength}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    🔄 Retake
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-900 bg-opacity-30 rounded-lg p-6 border border-red-700">
                  <div className="text-red-400 text-sm mb-2">Maximum Force</div>
                  <div className="text-white text-4xl font-bold mb-2">
                    {strengthData.maxForce?.toFixed(2)} kN
                  </div>
                  <div className="text-gray-300 text-base">
                    {(strengthData.maxForce * 1000).toFixed(0)} N
                  </div>
                </div>

                <div className="bg-yellow-900 bg-opacity-30 rounded-lg p-6 border border-yellow-700">
                  <div className="text-yellow-400 text-sm mb-2">Pressure</div>
                  <div className="text-white text-4xl font-bold mb-2">
                    {pressure ? pressure.toFixed(2) : 'N/A'} 
                  </div>
                  <div className="text-gray-300 text-base">
                    {pressure ? 'N/mm²' : '(needs dimensions)'}
                  </div>
                </div>

                <div className="bg-purple-900 bg-opacity-30 rounded-lg p-6 border border-purple-700">
                  <div className="text-purple-400 text-sm mb-2">Calculated Stress</div>
                  <div className="text-white text-4xl font-bold mb-2">
                    {stress ? stress.toFixed(2) : 'N/A'} 
                  </div>
                  <div className="text-gray-300 text-base">
                    {stress ? 'N/mm²' : '(needs dimensions)'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          {!specimenName && (
            <div className="bg-yellow-900 border border-yellow-700 text-yellow-200 px-6 py-4 rounded-lg mb-6">
              <strong>⚠️ Warning:</strong> No specimen name set. Database save will fail!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              type="button"
              onClick={onBackToMenu}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Test
            </button>
            
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !specimenName || !strengthData}
              className={`flex-1 px-6 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
                isSaving || !specimenName || !strengthData
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save to Database
                </>
              )}
            </button>
          </div>

          {/* Debug Preview */}
          <details className="bg-gray-800 rounded-lg p-4">
            <summary className="cursor-pointer text-gray-300 font-semibold mb-2">
              🔍 View Raw Data (Debug)
            </summary>
            <pre className="bg-gray-900 rounded p-4 overflow-auto text-xs text-gray-400">
              {JSON.stringify(prepareDataForDatabase(), null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default TestSummary;