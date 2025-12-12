import React, { useState, useEffect } from "react";

// Helper function to format moisture value to 2 decimal places
// Moisture meter shows single decimal (31.9) but we need 2 decimals (31.90)
const formatMoistureValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  // Convert to number if string
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return 0;
  }

  // Format to 2 decimal places and return as number
  return parseFloat(numValue.toFixed(2));
};

const TestSummary = ({
  testData,
  onRetakeMoisture,
  onRetakeMeasurement,
  onRetakeStrength,
  onSaveAndFinish,
  onBackToMenu,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extract data with fallbacks
  const testType = testData?.testType || "";
  const subType = testData?.subType || "";
  const specimenName = testData?.specimenName || "";
  const moistureData = testData?.moistureData || null;
  const measurementData = testData?.measurementData || null;
  const strengthData = testData?.strengthData || null;

  // Debug log on mount
  useEffect(() => {
    console.log("TestSummary mounted with data:", {
      testType,
      subType,
      specimenName,
      hasMoisture: !!moistureData,
      hasMeasurement: !!measurementData,
      hasStrength: !!strengthData,
    });
  }, []);

  // Calculate stress
  const calculateStress = () => {
    if (!measurementData || !strengthData) {
      console.log("Cannot calculate stress: missing data");
      return null;
    }

    if (!measurementData.areaMM2 || !strengthData.maxForce) {
      console.log("Cannot calculate stress: missing required fields");
      return null;
    }

    const area = measurementData.areaMM2; // mm²
    const maxForceN = strengthData.maxForce * 1000; // Convert kN to N

    let stress = 0;

    if (!testType || typeof testType !== "string") {
      console.log("Cannot calculate stress: invalid testType");
      return null;
    }

    try {
      const baseTestType = testType.toLowerCase().replace(" test", "").trim();

      if (baseTestType === "compressive") {
        // σ = P/A where P is force (N) and A is area (mm²)
        stress = maxForceN / area;
      } else if (baseTestType === "shear") {
        if (!measurementData.width || !measurementData.length) {
          console.log("Cannot calculate shear stress: missing dimensions");
          return null;
        }

        if (subType === "single") {
          const shearArea = measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        } else if (subType === "double") {
          const shearArea = 2 * measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        } else {
          // Default to single shear if subType not specified
          const shearArea = measurementData.width * measurementData.length;
          stress = maxForceN / shearArea;
        }
      } else if (baseTestType === "flexure") {
        if (!measurementData.width || !measurementData.height) {
          console.log("Cannot calculate flexure stress: missing dimensions");
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
      console.error("Error calculating stress:", err);
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

  // Prepare data WITHOUT sub_type field
  const prepareDataForDatabase = () => {
    if (!testType || typeof testType !== "string") {
      console.error("Cannot prepare data: invalid testType");
      return null;
    }

    try {
      const baseTestType = testType.toLowerCase().replace(" test", "").trim();

      // Create full test_type string (e.g., "Single Shear", "Parallel to Grain")
      let fullTestType = baseTestType;
      if (subType) {
        if (baseTestType === "shear") {
          fullTestType = `${subType.charAt(0).toUpperCase() + subType.slice(1)} Shear`;
        } else if (baseTestType === "compressive") {
          fullTestType = `${subType.charAt(0).toUpperCase() + subType.slice(1)} to Grain`;
        } else if (baseTestType === "flexure") {
          fullTestType = "Three Point Bending";
        }
      }

      // Match EXACT field names from your database schema - NO sub_type
      const dbData = {
        test_type: fullTestType, // Store full type in test_type
        specimen_name: specimenName || "Unnamed Specimen",
        base: measurementData?.width || 0,
        height: measurementData?.height || 0,
        length: measurementData?.length || 0,
        area: measurementData?.areaMM2 || 0,
        pressure: pressure || 0,
        moisture_content: formatMoistureValue(moistureData?.value),
        max_force: strengthData?.maxForce || 0,
        stress: stress || 0,
        species_id: null,
        photo: null,
      };

      console.log("Prepared database data:", dbData);
      return dbData;
    } catch (err) {
      console.error("Error preparing database data:", err);
      return null;
    }
  };

  // Handle save to database
  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const dbData = prepareDataForDatabase();

      if (!dbData) {
        throw new Error("Failed to prepare test data");
      }

      // Validate required fields
      if (!dbData.specimen_name) {
        throw new Error("Specimen name is required");
      }
      if (!dbData.max_force) {
        throw new Error("Strength test data is missing");
      }
      if (!dbData.test_type) {
        throw new Error("Test type is required");
      }

      const LARAVEL_API_URL =
        import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

      // Determine base test type for endpoint
      const baseTestType = testType.toLowerCase().replace(" test", "").trim();
      const endpoint = `${LARAVEL_API_URL}/api/${baseTestType}-data`;

      console.log("💾 Saving to database:", endpoint);
      console.log("📦 Data payload:", dbData);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(dbData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server response:", errorText);

        try {
          const errorData = JSON.parse(errorText);

          // Show specific validation errors if available
          if (errorData.errors) {
            const errorMessages = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
              .join("\n");
            throw new Error(`Validation errors:\n${errorMessages}`);
          }

          throw new Error(
            errorData.message || `Server error: ${response.status}`,
          );
        } catch (parseErr) {
          throw new Error(
            `Server error: ${response.status} - ${errorText.substring(0, 200)}`,
          );
        }
      }

      const result = await response.json();
      console.log("✅ Save successful:", result);

      setSaveSuccess(true);

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("❌ Save failed:", err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasMoisture = !!moistureData;
  const hasMeasurement = !!measurementData;
  const hasStrength = !!strengthData;

  return (
    <div className="w-full min-h-full flex flex-col bg-gray-900">
      {/* Header Bar - Matching SpecimenView design */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-100">
          Test Summary | {testType} | {specimenName || "Unnamed Specimen"}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !specimenName || !strengthData}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              isSaving || !specimenName || !strengthData
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {isSaving ? "Saving..." : "Save to Database"}
          </button>
          <button
            onClick={onBackToMenu}
            className="text-2xl text-gray-200 hover:text-gray-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Success Message */}
        {saveSuccess && (
          <div className="px-4 py-3 bg-green-900 border-b border-green-700">
            <div className="text-green-200 text-sm font-semibold">
              ✅ Success! Test data saved successfully to database!
            </div>
          </div>
        )}

        {/* Error Message */}
        {saveError && (
          <div className="px-4 py-3 bg-red-900 border-b border-red-700">
            <div className="text-red-200 text-sm font-semibold">
              ❌ Error: {saveError}
            </div>
          </div>
        )}

        {/* Warning Message */}
        {!specimenName && (
          <div className="px-4 py-3 bg-yellow-900 border-b border-yellow-700">
            <div className="text-yellow-200 text-sm font-semibold">
              ⚠️ Warning: No specimen name set. Database save will fail!
            </div>
          </div>
        )}

        {/* Test Information Section */}
        <div className="border-b border-gray-700">
          <div className="px-4 py-3 bg-gray-800">
            <div className="text-xs text-gray-400 mb-1">Test Information</div>
          </div>
          <div className="grid grid-cols-3 border-b border-gray-700">
            <div className="px-4 py-3 border-r border-gray-700">
              <div className="text-xs text-gray-400">Test Type :</div>
              <div className="mt-1 text-base font-medium text-gray-100">
                {testType}
              </div>
            </div>
            <div className="px-4 py-3 border-r border-gray-700">
              <div className="text-xs text-gray-400">Sub Type :</div>
              <div className="mt-1 text-base font-medium text-gray-100">
                {subType || "N/A"}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-gray-400">Specimen Name :</div>
              <div className="mt-1 text-base font-medium text-gray-100">
                {specimenName || "Not set"}
              </div>
            </div>
          </div>
        </div>

        {/* Moisture Content Section */}
        {hasMoisture && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <div className="text-xs text-gray-400">✓ Moisture Content</div>
              </div>
              {onRetakeMoisture && (
                <button
                  onClick={onRetakeMoisture}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="px-4 py-6 text-center border-b border-gray-700">
              <div className="text-5xl font-bold text-blue-400 mb-2">
                {moistureData.value} %
              </div>
              <div className="text-xs text-gray-400">
                {moistureData.timestamp
                  ? new Date(moistureData.timestamp).toLocaleString()
                  : "Just completed"}
              </div>
            </div>
          </div>
        )}

        {/* Dimension Measurement Section */}
        {hasMeasurement && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <div className="text-xs text-gray-400">
                  ✓ Dimension Measurement
                </div>
              </div>
              {onRetakeMeasurement && (
                <button
                  onClick={onRetakeMeasurement}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 border-b border-gray-700">
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Width (Base) :</div>
                <div className="mt-1 text-lg font-medium text-gray-100">
                  {measurementData.width?.toFixed(2)} mm
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {(measurementData.width / 25.4).toFixed(3)}"
                </div>
              </div>
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Height :</div>
                <div className="mt-1 text-lg font-medium text-gray-100">
                  {measurementData.height?.toFixed(2)} mm
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {(measurementData.height / 25.4).toFixed(3)}"
                </div>
              </div>
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Area (A = b × h) :</div>
                <div className="mt-1 text-lg font-medium text-gray-100">
                  {measurementData.areaMM2?.toFixed(2)} mm²
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {(measurementData.areaMM2 / 645.16).toFixed(3)} in²
                </div>
              </div>
              {measurementData.length && (
                <div className="px-4 py-3">
                  <div className="text-xs text-gray-400">Length :</div>
                  <div className="mt-1 text-lg font-medium text-gray-100">
                    {measurementData.length?.toFixed(2)} mm
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {(measurementData.length / 25.4).toFixed(3)}"
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strength Test Section */}
        {hasStrength && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <div className="text-xs text-gray-400">✓ Strength Test</div>
              </div>
              {onRetakeStrength && (
                <button
                  onClick={onRetakeStrength}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 border-b border-gray-700">
              <div className="px-4 py-4 border-r border-gray-700">
                <div className="text-xs text-gray-400 mb-2">
                  Maximum Force (P) :
                </div>
                <div className="text-3xl font-bold text-red-400 mb-1">
                  {strengthData.maxForce?.toFixed(2)} kN
                </div>
                <div className="text-xs text-gray-400">
                  {(strengthData.maxForce * 1000).toFixed(0)} N
                </div>
              </div>
              <div className="px-4 py-4 border-r border-gray-700">
                <div className="text-xs text-gray-400 mb-2">Pressure :</div>
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {pressure ? pressure.toFixed(2) : "N/A"}
                </div>
                <div className="text-xs text-gray-400">
                  {pressure ? "N/mm²" : "(needs dimensions)"}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-xs text-gray-400 mb-2">
                  Calculated Stress (σ) :
                </div>
                <div className="text-3xl font-bold text-purple-400 mb-1">
                  {stress ? stress.toFixed(2) : "N/A"}
                </div>
                <div className="text-xs text-gray-400">
                  {stress ? "N/mm²" : "(needs dimensions)"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Preview Section */}
        <div className="border-b border-gray-700">
          <details className="group">
            <summary className="px-4 py-3 bg-gray-800 cursor-pointer text-xs text-gray-400 hover:text-gray-300 transition-colors">
              🔍 View Raw Data (Debug)
            </summary>
            <div className="px-4 py-4 bg-gray-900">
              <pre className="text-xs text-gray-400 overflow-auto">
                {JSON.stringify(prepareDataForDatabase(), null, 2)}
              </pre>
            </div>
          </details>
        </div>

        {/* Action Buttons Section */}
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Start New Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSummary;
