import React, { useState } from "react";
import "./WoodTests.css";
import { useTouchControls } from "../../Utils/TouchControls";
import KiloNewtonGauge from "./KiloNewtonGuage";
import MoistureTestPage from "./MoistureTest";
import DimensionMeasurementPage from "./Measurement";
import TestSummary from "./TestSummary";

const WoodTests = ({ darkMode = false }) => {
  // State management
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [subType, setSubType] = useState("");
  const [specimenName, setSpecimenName] = useState("");
  const [includeMeasurement, setIncludeMeasurement] = useState(false);
  const [includeMoisture, setIncludeMoisture] = useState(false);
  const [audio] = useState(new Audio("Sounds/UI/button_press_Beep.mp3"));
  const [testStarted, setTestStarted] = useState(false);
  const [currentTestStage, setCurrentTestStage] = useState("selection");
  const [slideDirection, setSlideDirection] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Test data storage
  const [testData, setTestData] = useState({
    testType: "",
    subType: "",
    specimenName: "",
    moistureData: null,
    measurementData: null,
    strengthData: null,
  });

  // Updated with correct image paths from your code
  const tests = [
    {
      title: "COMPRESSIVE TEST",
      image: "Cards/Strength Test/Compressive_Card.png",
    },
    { title: "SHEAR TEST", image: "Cards/Strength Test/Shear_Card.png" },
    { title: "FLEXURE TEST", image: "Cards/Strength Test/Flexure_Card.png" },
  ];

  // Add touch event handlers after the goToNextCard function (around line 80)
  const handleTouchStart = (e) => {
    if (isAnimating || isTransitioning) return;
    setIsDragging(true);
    setDragStart(e.touches[0].clientX);
    setDragOffset(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || isAnimating || isTransitioning) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - dragStart;

    // Prevent dragging if at boundaries
    if (
      (currentCardIndex === 0 && diff > 0) ||
      (currentCardIndex === tests.length - 1 && diff < 0)
    ) {
      return;
    }

    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || isAnimating || isTransitioning) return;

    const currentOffset = dragOffset;
    setIsDragging(false);
    const threshold = window.innerWidth * 0.25; // 25% of screen width

    if (Math.abs(currentOffset) > threshold) {
      // Swipe detected - continue the animation from current position
      setIsTransitioning(true);
      setIsAnimating(true);

      if (currentOffset < 0 && currentCardIndex < tests.length - 1) {
        // Swiped left - UPDATE INDEX IMMEDIATELY
        audio.play();
        setCurrentCardIndex((prev) => prev + 1);
        setSlideDirection("slide-in-from-right");
        setDragOffset(0);

        setTimeout(() => {
          setSlideDirection("");
          setIsAnimating(false);
          setIsTransitioning(false);
        }, 200);
      } else if (currentOffset > 0 && currentCardIndex > 0) {
        // Swiped right - UPDATE INDEX IMMEDIATELY
        audio.play();
        setCurrentCardIndex((prev) => prev - 1);
        setSlideDirection("slide-in-from-left");
        setDragOffset(0);

        setTimeout(() => {
          setSlideDirection("");
          setIsAnimating(false);
          setIsTransitioning(false);
        }, 200);
      } else {
        // Snap back
        setIsTransitioning(false);
        setIsAnimating(false);
        setDragOffset(0);
      }
    } else {
      // Snap back - didn't reach threshold
      setIsTransitioning(true);
      setTimeout(() => {
        setDragOffset(0);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 200);
      }, 0);
    }
  };

  // Navigation functions - NO LOOPS
  const goToPreviousCard = () => {
    if (currentCardIndex > 0 && !isAnimating) {
      audio.play();
      setIsAnimating(true);
      setSlideDirection("slide-out-right");

      setTimeout(() => {
        setCurrentCardIndex((prev) => prev - 1);
        setSlideDirection("slide-in-from-left");

        setTimeout(() => {
          setSlideDirection("");
          setIsAnimating(false);
        }, 300);
      }, 300);
    }
  };

  const goToNextCard = () => {
    if (currentCardIndex < tests.length - 1 && !isAnimating) {
      audio.play();
      setIsAnimating(true);
      setSlideDirection("slide-out-left");

      setTimeout(() => {
        setCurrentCardIndex((prev) => prev + 1);
        setSlideDirection("slide-in-from-right");

        setTimeout(() => {
          setSlideDirection("");
          setIsAnimating(false);
        }, 300);
      }, 300);
    }
  };

  const handleTestClick = (title) => {
    audio.play();
    setSelectedTest(title);
    resetSelections();
  };

  const resetSelections = () => {
    setSubType("");
    setSpecimenName("");
    setIncludeMeasurement(false);
    setIncludeMoisture(false);
    setCurrentTestStage("selection");
    setTestData({
      testType: "",
      subType: "",
      specimenName: "",
      moistureData: null,
      measurementData: null,
      strengthData: null,
    });
  };

  const isFormValid = () => {
    if (!specimenName || specimenName.trim() === "") {
      return false;
    }

    if (selectedTest === "COMPRESSIVE TEST" || selectedTest === "SHEAR TEST") {
      return subType !== "";
    }

    return true;
  };

  const handleClose = () => {
    audio.play();
    setSelectedTest(null);
  };

  const determineTestSequence = () => {
    const sequence = [];
    if (includeMoisture) sequence.push("moistureTest");
    sequence.push("dimensionTest"); // Always include measurement
    sequence.push("mainTest");
    sequence.push("summary");
    return sequence;
  };

  const handleBeginTest = () => {
    audio.play();

    if (!isFormValid()) {
      alert("Please fill in all required fields before starting the test.");
      return;
    }

    setTestData((prev) => ({
      ...prev,
      testType: selectedTest,
      subType: subType,
      specimenName: specimenName,
    }));

    setTestStarted(true);

    const sequence = determineTestSequence();
    if (sequence.length > 0) {
      setCurrentTestStage(sequence[0]);
    }
  };

  const handleMoistureComplete = (data) => {
    setTestData((prev) => ({
      ...prev,
      moistureData: data,
    }));

    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("moistureTest");
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleRetakeMoisture = () => {
    setCurrentTestStage("moistureTest");
  };

  const handleMoisturePrevious = () => {
    // Go back to selection screen
    setTestStarted(false);
    setCurrentTestStage("selection");
  };

  const handleMeasurementComplete = (data) => {
    setTestData((prev) => ({
      ...prev,
      measurementData: data,
    }));

    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("dimensionTest");
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleRetakeMeasurement = () => {
    setCurrentTestStage("dimensionTest");
  };

  const handleMeasurementPrevious = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("dimensionTest");

    // Go back to previous stage in sequence
    if (currentIndex > 0) {
      setCurrentTestStage(sequence[currentIndex - 1]);
    } else {
      // If first stage, go back to selection
      setTestStarted(false);
      setCurrentTestStage("selection");
    }
  };

  const handleTestComplete = (data) => {
    setTestData((prev) => ({
      ...prev,
      strengthData: data,
    }));

    setCurrentTestStage("summary");
  };

  const handleRetakeStrength = () => {
    setCurrentTestStage("mainTest");
  };

  const handleStrengthPrevious = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("mainTest");

    // Go back to previous stage in sequence
    if (currentIndex > 0) {
      setCurrentTestStage(sequence[currentIndex - 1]);
    } else {
      // If first stage, go back to selection
      setTestStarted(false);
      setCurrentTestStage("selection");
    }
  };

  const handleSummaryComplete = () => {
    setTestStarted(false);
    setSelectedTest(null);
    resetSelections();
  };

  // Render test stages
  if (testStarted) {
    if (currentTestStage === "moistureTest") {
      return (
        <MoistureTestPage
          onTestComplete={handleMoistureComplete}
          onPreviousTest={handleMoisturePrevious}
          onMainPageReturn={() => {
            setTestStarted(false);
            setSelectedTest(null);
            resetSelections();
          }}
          specimenName={specimenName}
        />
      );
    }

    if (currentTestStage === "dimensionTest") {
      return (
        <DimensionMeasurementPage
          onTestComplete={handleMeasurementComplete}
          onPreviousTest={handleMeasurementPrevious}
          onMainPageReturn={() => {
            setTestStarted(false);
            setSelectedTest(null);
            resetSelections();
          }}
          specimenName={specimenName}
          testType={selectedTest.toLowerCase().replace(" test", "")}
          subType={subType}
        />
      );
    }

    if (currentTestStage === "mainTest") {
      return (
        <KiloNewtonGauge
          testType={selectedTest}
          subType={subType}
          specimenName={specimenName}
          moistureData={testData.moistureData}
          measurementData={testData.measurementData}
          onTestComplete={handleTestComplete}
          onPreviousTest={handleStrengthPrevious}
          onMainPageReturn={() => {
            setTestStarted(false);
            setSelectedTest(null);
            resetSelections();
          }}
        />
      );
    }

    if (currentTestStage === "summary") {
      return (
        <TestSummary
          testData={testData}
          onRetakeMoisture={includeMoisture ? handleRetakeMoisture : null}
          onRetakeMeasurement={handleRetakeMeasurement}
          onRetakeStrength={handleRetakeStrength}
          onBackToMenu={handleSummaryComplete}
        />
      );
    }
  }

  // Main selection UI
  if (!selectedTest) {
    return (
      <div
        className={`flex flex-col h-full ${darkMode ? "bg-gray-900" : "bg-white"}`}
      >
        {/* Card Container - Centered, Full Width */}
        <div className="flex-1 flex items-start justify-center px-0 pt-0">
          <div
            onClick={() =>
              !isDragging &&
              !isAnimating &&
              handleTestClick(tests[currentCardIndex].title)
            }
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`w-full border-2 cursor-pointer hover:shadow-xl flex flex-col ${
              darkMode
                ? "border-gray-600 bg-gray-800 hover:shadow-gray-700"
                : "border-black bg-gray-200"
            } ${slideDirection}`}
            style={{
              height: "380px",
              transform:
                isDragging && dragOffset !== 0
                  ? `translateX(${dragOffset}px)`
                  : undefined,
              opacity:
                isDragging && dragOffset !== 0
                  ? Math.max(0.5, 1 - Math.abs(dragOffset) / window.innerWidth)
                  : undefined,
              transition: isDragging ? "none" : undefined,
            }}
          >
            {/* Image Area - Top Part */}
            <div
              className={`flex-1 flex items-center justify-center overflow-hidden ${
                darkMode ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <img
                src={tests[currentCardIndex].image}
                alt={tests[currentCardIndex].title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error(
                    "Image failed to load:",
                    tests[currentCardIndex].image,
                  );
                }}
              />
            </div>

            {/* Label - Bottom Part */}
            <div
              className={`h-[60px] border-t-2 flex items-center justify-center ${
                darkMode
                  ? "bg-gray-700 border-gray-600 text-gray-100"
                  : "bg-gray-300 border-black text-gray-900"
              }`}
            >
              <h2 className="text-2xl font-bold tracking-wide">
                {tests[currentCardIndex].title}
              </h2>
            </div>
          </div>
        </div>

        {/* Navigation Dots - Below Card */}
        <div className="flex items-center justify-center gap-3 pb-4">
          {tests.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (index !== currentCardIndex && !isAnimating) {
                  audio.play();
                  setIsAnimating(true);

                  // Going forward (right to left)
                  if (index > currentCardIndex) {
                    setSlideDirection("slide-out-left");

                    setTimeout(() => {
                      setCurrentCardIndex(index);
                      setSlideDirection("slide-in-from-right");

                      setTimeout(() => {
                        setSlideDirection("");
                        setIsAnimating(false);
                      }, 300);
                    }, 300);
                  }
                  // Going backward (left to right)
                  else {
                    setSlideDirection("slide-out-right");

                    setTimeout(() => {
                      setCurrentCardIndex(index);
                      setSlideDirection("slide-in-from-left");

                      setTimeout(() => {
                        setSlideDirection("");
                        setIsAnimating(false);
                      }, 300);
                    }, 300);
                  }
                }
              }}
              className={`w-3 h-3 rounded-full transition-all border-2 ${
                darkMode
                  ? index === currentCardIndex
                    ? "bg-blue-400 border-blue-400"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                  : index === currentCardIndex
                    ? "bg-gray-400 border-gray-400"
                    : "bg-white border-gray-400 hover:bg-gray-200"
              }`}
              aria-label={`Go to ${tests[index].title}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Test configuration screen
  // Test configuration screen
  return (
    <div
      className={`flex flex-col h-full ${darkMode ? "bg-gray-900" : "bg-white"}`}
    >
      {/* Header - Increased font size */}
      <div
        className={`flex items-center justify-between px-2 py-1 border-b-2 ${
          darkMode
            ? "border-gray-700 bg-gray-800 text-gray-100"
            : "border-black bg-gray-100 text-gray-900"
        }`}
      >
        <h2 className="text-[17px] font-bold">{selectedTest}</h2>
        <button
          onClick={handleClose}
          className={`text-[26px] font-bold transition-colors ${
            darkMode
              ? "text-gray-200 hover:text-red-400"
              : "text-gray-900 hover:text-red-600"
          }`}
        >
          ×
        </button>
      </div>

      {/* Configuration Form - FLEX COLUMN */}
      <div className="flex-1 flex flex-col">
        {/* Specimen Name Input - Increased font size */}
        <div className="border-b-2 border-gray-300 p-2">
          <label
            className={`block text-[13px] font-semibold mb-1 ${
              darkMode ? "text-gray-300" : "text-gray-900"
            }`}
          >
            Specimen Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={specimenName}
            onChange={(e) => setSpecimenName(e.target.value)}
            onFocus={(e) => {
              // Optional: stop OS keyboard on touchscreens
              // The virtual keyboard will still open because GlobalKeyboardProvider listens to focusin
              if ("ontouchstart" in window) {
                e.target.blur();
                setTimeout(() => e.target.focus(), 0);
              }
            }}
            placeholder="Enter specimen name"
            data-keyboard="1"
            className={`w-full px-2 py-1.5 border-2 focus:outline-none text-[15px] keyboard-trigger ${
              darkMode
                ? "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
            }`}
          />

        </div>

        {/* Two Column Layout - TAKES UP REMAINING SPACE */}
        <div
          className={`flex-1 grid grid-cols-2 border-b-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
        >
          {/* LEFT COLUMN - Sub-type Selection */}
          {(selectedTest === "COMPRESSIVE TEST" ||
            selectedTest === "SHEAR TEST") && (
            <div
              className={`flex flex-col border-r-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
            >
              <label
                className={`block text-[13px] font-semibold px-2 pt-2 pb-1 border-b-2 ${
                  darkMode
                    ? "text-gray-300 border-gray-700"
                    : "text-gray-900 border-gray-300"
                }`}
              >
                Test Sub-type <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 flex flex-col">
                {selectedTest === "COMPRESSIVE TEST" ? (
                  <>
                    <button
                      onClick={() => {
                        audio.play();
                        setSubType("Parallel");
                      }}
                      className={`flex-1 px-2 text-[1.5rem] font-semibold transition-all border-b-2 ${
                        subType === "Parallel"
                          ? darkMode
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-blue-500 text-white border-blue-500"
                          : darkMode
                            ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
                            : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      PARALLEL TO GRAIN
                    </button>
                    <button
                      onClick={() => {
                        audio.play();
                        setSubType("Perpendicular");
                      }}
                      className={`flex-1 px-2 text-[1.5rem] font-semibold transition-all ${
                        subType === "Perpendicular"
                          ? darkMode
                            ? "bg-blue-600 text-white"
                            : "bg-blue-500 text-white"
                          : darkMode
                            ? "bg-gray-800 text-gray-200 hover:bg-gray-700"
                            : "bg-white text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      PERPENDICULAR TO GRAIN
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        audio.play();
                        setSubType("Single");
                      }}
                      className={`flex-1 px-2 text-[1.5rem] font-semibold transition-all border-b-2 ${
                        subType === "Single"
                          ? darkMode
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-blue-500 text-white border-blue-500"
                          : darkMode
                            ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
                            : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      SINGLE SHEAR
                    </button>
                    <button
                      onClick={() => {
                        audio.play();
                        setSubType("Double");
                      }}
                      className={`flex-1 px-2 text-[1.5rem] font-semibold transition-all ${
                        subType === "Double"
                          ? darkMode
                            ? "bg-blue-600 text-white"
                            : "bg-blue-500 text-white"
                          : darkMode
                            ? "bg-gray-800 text-gray-200 hover:bg-gray-700"
                            : "bg-white text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      DOUBLE SHEAR
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* If no sub-type needed, span full width for Test Procedure */}
          {!(
            selectedTest === "COMPRESSIVE TEST" || selectedTest === "SHEAR TEST"
          ) && (
            <div className="col-span-2 flex flex-col">
              <label
                className={`block text-[13px] font-semibold px-2 pt-2 pb-1 border-b-2 ${
                  darkMode
                    ? "text-gray-300 border-gray-700"
                    : "text-gray-900 border-gray-300"
                }`}
              >
                Test Procedure
              </label>
              <div className="flex-1 flex flex-col">
                <label
                  className={`flex-1 flex items-center gap-2 px-2 border-b-2 cursor-pointer transition-colors ${
                    darkMode
                      ? "border-gray-600 bg-gray-800 hover:bg-gray-700"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  } ${includeMoisture ? (darkMode ? "bg-blue-900" : "bg-blue-100") : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={includeMoisture}
                    onChange={(e) => {
                      audio.play();
                      setIncludeMoisture(e.target.checked);
                    }}
                    className="w-4 h-4"
                  />
                  <span
                    className={`font-medium text-[15px] ${
                      darkMode ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Moisture Test
                  </span>
                </label>
                <div
                  className={`flex-1 flex items-center gap-2 px-2 border-b-2 ${
                    darkMode
                      ? "bg-gray-700 text-gray-300 border-gray-600"
                      : "bg-gray-200 text-gray-700 border-gray-300"
                  }`}
                >
                  <span className="font-medium text-[15px]">Measurement Test</span>
                  <span className="ml-auto text-xs text-green-400">✓ Required</span>
                </div>
                <div
                  className={`flex-1 flex items-center gap-2 px-2 ${
                    darkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  <span className="font-medium text-[15px]">Strength Test</span>
                  <span className="ml-auto text-xs text-green-400">✓ Required</span>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT COLUMN - Test Procedure (only if sub-type exists) */}
          {(selectedTest === "COMPRESSIVE TEST" ||
            selectedTest === "SHEAR TEST") && (
            <div className="flex flex-col">
              <label
                className={`block text-[13px] font-semibold px-2 pt-2 pb-1 border-b-2 ${
                  darkMode
                    ? "text-gray-300 border-gray-700"
                    : "text-gray-900 border-gray-300"
                }`}
              >
                Test Procedure
              </label>
              <div className="flex-1 flex flex-col">
                <label
                  className={`flex-1 flex items-center gap-2 px-2 border-b-2 cursor-pointer transition-colors ${
                    darkMode
                      ? "border-gray-600 bg-gray-800 hover:bg-gray-700"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  } ${includeMoisture ? (darkMode ? "bg-blue-900" : "bg-blue-100") : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={includeMoisture}
                    onChange={(e) => {
                      audio.play();
                      setIncludeMoisture(e.target.checked);
                    }}
                    className="w-4 h-4"
                  />
                  <span
                    className={`font-medium text-[1.5rem] ${
                      darkMode ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Moisture Test
                  </span>
                </label>
                <div
                  className={`flex-1 flex items-center gap-2 px-2 border-b-2 ${
                    darkMode
                      ? "bg-gray-700 text-gray-300 border-gray-600"
                      : "bg-gray-200 text-gray-700 border-gray-300"
                  }`}
                >
                  <span className="font-medium text-[1.5rem]">
                    Measurement Test
                  </span>
                  <span className="ml-auto text-xs text-green-400">✓ Required</span>
                </div>
                <div
                  className={`flex-1 flex items-center gap-2 px-2 ${
                    darkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  <span className="font-medium text-[1.5rem]">
                    Strength Test
                  </span>
                  <span className="ml-auto text-xs text-green-400">✓ Required</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Begin Test Button - Increased font size */}
        <button
          onClick={handleBeginTest}
          disabled={!isFormValid()}
          className={`py-4 text-[20px] font-bold transition-all ${
            isFormValid()
              ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.99]"
              : darkMode
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          START
        </button>
      </div>
    </div>
  );
};

export default WoodTests;