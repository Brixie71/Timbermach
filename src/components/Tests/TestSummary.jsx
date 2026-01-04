import React, { useState, useEffect } from "react";

// Helper function to format moisture value
const formatMoistureValue = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return 0;
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

  // Extract data
  const testType = testData?.testType || "";
  const subType = testData?.subType || "";
  const specimenName = testData?.specimenName || "";
  const moistureData = testData?.moistureData || null;
  const measurementData = testData?.measurementData || null;
  const strengthData = testData?.strengthData || null;

  useEffect(() => {
    console.log("=== TestSummary Debug ===");
    console.log("Full testData:", testData);
    console.log("testType:", testType);
    console.log("subType:", subType);
    console.log("specimenName:", specimenName);
    console.log("moistureData:", moistureData);
    console.log("measurementData:", measurementData);
    console.log("strengthData:", strengthData);
    console.log("========================");
  }, [testData]);

  // Calculate stress
  const calculateStress = () => {
    if (!measurementData || !strengthData) {
      console.log("Cannot calculate stress: missing data");
      return null;
    }

    const area = measurementData.areaMM2;
    // strengthData.maxForce is in MPa (pressure), we need force in N
    // If we have maxPressureMPa, use that instead
    const pressureMPa = strengthData.maxPressureMPa || strengthData.maxForce;
    
    if (!area || !pressureMPa) {
      console.log("Cannot calculate stress: missing required values");
      return null;
    }

    // Pressure (MPa) = Force (N) / Area (mm²)
    // Therefore: Force (N) = Pressure (MPa) * Area (mm²)
    const forceN = pressureMPa * area;

    let stress = 0;
    const baseTestType = testType.toLowerCase().replace(" test", "").trim();

    try {
      if (baseTestType === "compressive") {
        stress = forceN / area; // σ = P/A
      } else if (baseTestType === "shear") {
        if (subType === "single") {
          const shearArea = measurementData.width * measurementData.length;
          stress = forceN / shearArea;
        } else if (subType === "double") {
          const shearArea = 2 * measurementData.width * measurementData.length;
          stress = forceN / shearArea;
        }
      } else if (baseTestType === "flexure") {
        const P = forceN;
        const L = measurementData.length || 800;
        const b = measurementData.width;
        const h = measurementData.height;
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

  // Get pressure directly from strengthData (it's already in MPa)
  const pressure = strengthData?.maxPressureMPa || strengthData?.maxForce || null;

  // Calculate actual force in kN
  const calculateForceKN = () => {
    if (!measurementData?.areaMM2 || !pressure) return null;
    // Force (N) = Pressure (MPa = N/mm²) * Area (mm²)
    const forceN = pressure * measurementData.areaMM2;
    return forceN / 1000; // Convert to kN
  };

  const forceKN = calculateForceKN();

  // Prepare database data
  const prepareDataForDatabase = () => {
    if (!testType) return null;

    try {
      const baseTestType = testType.toLowerCase().replace(" test", "").trim();

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

      const dbData = {
        test_type: fullTestType,
        specimen_name: specimenName || "Unnamed Specimen",
        base: measurementData?.width || 0,
        height: measurementData?.height || 0,
        length: measurementData?.length || 0,
        area: measurementData?.areaMM2 || 0,
        pressure: pressure || 0,  // MPa
        moisture_content: formatMoistureValue(moistureData?.value),
        max_force: forceKN || 0,  // kN (calculated from pressure * area)
        stress: stress || 0,
        species_id: null,
        photo: null,
      };

      console.log("📦 Prepared database data:", dbData);
      return dbData;
    } catch (err) {
      console.error("Error preparing database data:", err);
      return null;
    }
  };

  // Handle save
  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const dbData = prepareDataForDatabase();

      if (!dbData) {
        throw new Error("Failed to prepare test data");
      }

      if (!dbData.specimen_name) {
        throw new Error("Specimen name is required");
      }
      if (!dbData.pressure) {
        throw new Error("Strength test data is missing");
      }
      if (!dbData.test_type) {
        throw new Error("Test type is required");
      }

      const LARAVEL_API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
      const baseTestType = testType.toLowerCase().replace(" test", "").trim();
      const endpoint = `${LARAVEL_API_URL}/api/${baseTestType}-data`;

      console.log("💾 Saving to:", endpoint);
      console.log("📤 Payload:", dbData);

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
          if (errorData.errors) {
            const errorMessages = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
              .join("\n");
            throw new Error(`Validation errors:\n${errorMessages}`);
          }
          throw new Error(errorData.message || `Server error: ${response.status}`);
        } catch (parseErr) {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const result = await response.json();
      console.log("✅ Save successful:", result);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
      {/* Header Bar */}
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <div className="px-4 py-3 bg-green-900 border-b border-green-700">
            <div className="text-green-200 text-sm font-semibold">
              ✅ Success! Test data saved to database!
            </div>
          </div>
        )}

        {saveError && (
          <div className="px-4 py-3 bg-red-900 border-b border-red-700">
            <div className="text-red-200 text-sm font-semibold">
              ❌ Error: {saveError}
            </div>
          </div>
        )}

        {!specimenName && (
          <div className="px-4 py-3 bg-yellow-900 border-b border-yellow-700">
            <div className="text-yellow-200 text-sm font-semibold">
              ⚠️ Warning: No specimen name set!
            </div>
          </div>
        )}

        {/* Test Information */}
        <div className="border-b border-gray-700">
          <div className="px-4 py-3 bg-gray-800">
            <div className="text-xs text-gray-400 mb-1">Test Information</div>
          </div>
          <div className="grid grid-cols-3 border-b border-gray-700">
            <div className="px-4 py-3 border-r border-gray-700">
              <div className="text-xs text-gray-400">Test Type:</div>
              <div className="mt-1 text-base font-medium text-gray-100">{testType}</div>
            </div>
            <div className="px-4 py-3 border-r border-gray-700">
              <div className="text-xs text-gray-400">Sub Type:</div>
              <div className="mt-1 text-base font-medium text-gray-100">{subType || "N/A"}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-gray-400">Specimen Name:</div>
              <div className="mt-1 text-base font-medium text-gray-100">{specimenName || "Not set"}</div>
            </div>
          </div>
        </div>

        {/* Moisture Content */}
        {hasMoisture && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <div className="text-xs text-gray-400">✓ Moisture Content</div>
              </div>
              {onRetakeMoisture && (
                <button onClick={onRetakeMoisture} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="px-4 py-6 text-center border-b border-gray-700">
              <div className="text-5xl font-bold text-blue-400 mb-2">{moistureData.value} %</div>
              <div className="text-xs text-gray-400">
                {moistureData.timestamp ? new Date(moistureData.timestamp).toLocaleString() : "Just completed"}
              </div>
            </div>
          </div>
        )}

        {/* Dimensions */}
        {hasMeasurement && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <div className="text-xs text-gray-400">✓ Dimension Measurement</div>
              </div>
              {onRetakeMeasurement && (
                <button onClick={onRetakeMeasurement} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 border-b border-gray-700">
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Width (Base):</div>
                <div className="mt-1 text-lg font-medium text-gray-100">{measurementData.width?.toFixed(2)} mm</div>
                <div className="mt-1 text-xs text-gray-400">{(measurementData.width / 25.4).toFixed(3)}"</div>
              </div>
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Height:</div>
                <div className="mt-1 text-lg font-medium text-gray-100">{measurementData.height?.toFixed(2)} mm</div>
                <div className="mt-1 text-xs text-gray-400">{(measurementData.height / 25.4).toFixed(3)}"</div>
              </div>
              <div className="px-4 py-3 border-r border-gray-700">
                <div className="text-xs text-gray-400">Area (A = b × h):</div>
                <div className="mt-1 text-lg font-medium text-gray-100">{measurementData.areaMM2?.toFixed(2)} mm²</div>
                <div className="mt-1 text-xs text-gray-400">{(measurementData.areaMM2 / 645.16).toFixed(3)} in²</div>
              </div>
              {measurementData.length && (
                <div className="px-4 py-3">
                  <div className="text-xs text-gray-400">Length:</div>
                  <div className="mt-1 text-lg font-medium text-gray-100">{measurementData.length?.toFixed(2)} mm</div>
                  <div className="mt-1 text-xs text-gray-400">{(measurementData.length / 25.4).toFixed(3)}"</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strength Test Results */}
        {hasStrength && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <div className="text-xs text-gray-400">✓ Strength Test</div>
              </div>
              {onRetakeStrength && (
                <button onClick={onRetakeStrength} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                  🔄 Retake
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 border-b border-gray-700">
              <div className="px-4 py-4 border-r border-gray-700">
                <div className="text-xs text-gray-400 mb-2">Maximum Pressure:</div>
                <div className="text-3xl font-bold text-red-400 mb-1">
                  {pressure ? pressure.toFixed(2) : "N/A"} MPa
                </div>
                <div className="text-xs text-gray-400">
                  {forceKN ? `${forceKN.toFixed(2)} kN` : "N/A"}
                </div>
              </div>
              <div className="px-4 py-4 border-r border-gray-700">
                <div className="text-xs text-gray-400 mb-2">Force (P):</div>
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {forceKN ? forceKN.toFixed(2) : "N/A"}
                </div>
                <div className="text-xs text-gray-400">
                  {forceKN ? `${(forceKN * 1000).toFixed(0)} N` : "(needs dimensions)"}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-xs text-gray-400 mb-2">Stress (σ):</div>
                <div className="text-3xl font-bold text-purple-400 mb-1">
                  {stress ? stress.toFixed(2) : "N/A"}
                </div>
                <div className="text-xs text-gray-400">
                  {stress ? "MPa" : "(needs dimensions)"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Preview */}
        <div className="border-b border-gray-700">
          <details className="group">
            <summary className="px-4 py-3 bg-gray-800 cursor-pointer text-xs text-gray-400 hover:text-gray-300">
              🔍 View Database Payload (Debug)
            </summary>
            <div className="px-4 py-4 bg-gray-900">
              <pre className="text-xs text-gray-400 overflow-auto">
                {JSON.stringify(prepareDataForDatabase(), null, 2)}
              </pre>
            </div>
          </details>
        </div>

        {/* Actions */}
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold"
          >
            Start New Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSummary;