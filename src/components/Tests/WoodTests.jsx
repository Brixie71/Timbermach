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
    { title: "COMPRESSIVE TEST", image: "Cards/Strength Test/Compressive_Card.png" },
    { title: "SHEAR TEST", image: "Cards/Strength Test/Shear_Card.png" },
    { title: "FLEXURE TEST", image: "Cards/Strength Test/Flexure_Card.png" },
  ];

  // Touch handlers
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

    const threshold = window.innerWidth * 0.25;

    if (Math.abs(currentOffset) > threshold) {
      setIsTransitioning(true);
      setIsAnimating(true);

      if (currentOffset < 0 && currentCardIndex < tests.length - 1) {
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
        setIsTransitioning(false);
        setIsAnimating(false);
        setDragOffset(0);
      }
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setDragOffset(0);
        setTimeout(() => setIsTransitioning(false), 200);
      }, 0);
    }
  };

  // Navigation functions
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
    if (!specimenName || specimenName.trim() === "") return false;
    if (selectedTest === "COMPRESSIVE TEST" || selectedTest === "SHEAR TEST") return subType !== "";
    return true;
  };

  const handleClose = () => {
    audio.play();
    setSelectedTest(null);
  };

  const determineTestSequence = () => {
    const sequence = [];
    if (includeMoisture) sequence.push("moistureTest");
    sequence.push("dimensionTest");
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
    if (sequence.length > 0) setCurrentTestStage(sequence[0]);
  };

  const handleMoistureComplete = (data) => {
    setTestData((prev) => ({ ...prev, moistureData: data }));

    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("moistureTest");
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleRetakeMoisture = () => setCurrentTestStage("moistureTest");

  const handleMoisturePrevious = () => {
    setTestStarted(false);
    setCurrentTestStage("selection");
  };

  const handleMeasurementComplete = (data) => {
    setTestData((prev) => ({ ...prev, measurementData: data }));

    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("dimensionTest");
    if (currentIndex !== -1 && currentIndex + 1 < sequence.length) {
      setCurrentTestStage(sequence[currentIndex + 1]);
    }
  };

  const handleRetakeMeasurement = () => setCurrentTestStage("dimensionTest");

  const handleMeasurementPrevious = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("dimensionTest");

    if (currentIndex > 0) setCurrentTestStage(sequence[currentIndex - 1]);
    else {
      setTestStarted(false);
      setCurrentTestStage("selection");
    }
  };

  const handleTestComplete = (data) => {
    setTestData((prev) => ({ ...prev, strengthData: data }));
    setCurrentTestStage("summary");
  };

  const handleRetakeStrength = () => setCurrentTestStage("mainTest");

  const handleStrengthPrevious = () => {
    const sequence = determineTestSequence();
    const currentIndex = sequence.indexOf("mainTest");

    if (currentIndex > 0) setCurrentTestStage(sequence[currentIndex - 1]);
    else {
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

  // Main selection UI (UNCHANGED from your reverted version)
  if (!selectedTest) {
    return (
      <div className={`flex flex-col h-full ${darkMode ? "bg-gray-900" : "bg-white"}`}>
        <div className="flex-1 flex items-start justify-center px-0 pt-0">
          <div
            onClick={() => !isDragging && !isAnimating && handleTestClick(tests[currentCardIndex].title)}
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
              transform: isDragging && dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
              opacity:
                isDragging && dragOffset !== 0
                  ? Math.max(0.5, 1 - Math.abs(dragOffset) / window.innerWidth)
                  : undefined,
              transition: isDragging ? "none" : undefined,
            }}
          >
            <div
              className={`flex-1 flex items-center justify-center overflow-hidden ${
                darkMode ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <img
                src={tests[currentCardIndex].image}
                alt={tests[currentCardIndex].title}
                className="w-full h-full object-cover"
                onError={() => console.error("Image failed to load:", tests[currentCardIndex].image)}
              />
            </div>

            <div
              className={`h-[60px] border-t-2 flex items-center justify-center ${
                darkMode
                  ? "bg-gray-700 border-gray-600 text-gray-100"
                  : "bg-gray-300 border-black text-gray-900"
              }`}
            >
              <h2 className="text-2xl font-bold tracking-wide">{tests[currentCardIndex].title}</h2>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pb-4">
          {tests.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (index !== currentCardIndex && !isAnimating) {
                  audio.play();
                  setIsAnimating(true);

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
                  } else {
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

  // ============================
  // CONFIG SCREEN (IMPROVED ONLY)
  // ============================
  const border = darkMode ? "border-gray-800" : "border-gray-200";
  const surface = darkMode ? "bg-gray-900" : "bg-white";
  const surface2 = darkMode ? "bg-gray-900/70" : "bg-gray-50";
  const text = darkMode ? "text-gray-100" : "text-gray-900";
  const subText = darkMode ? "text-gray-300" : "text-gray-600";
  const softBtn = darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10";

  const Btn = ({ active, onClick, children, className = "" }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 w-full px-3",
        "text-[18px] font-extrabold tracking-wide",
        "transition active:scale-[0.99]",
        active
          ? darkMode
            ? "bg-blue-600 text-white"
            : "bg-blue-600 text-white"
          : `${softBtn} ${text}`,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );

  const RowItem = ({ children, right }) => (
    <div
      className={[
        "flex-1 flex items-center px-3",
        darkMode ? "bg-white/5" : "bg-gray-100",
        "border-b",
        border,
      ].join(" ")}
    >
      <div className={["text-[18px] font-semibold", text].join(" ")}>{children}</div>
      {right ? <div className="ml-auto text-[13px] font-bold text-emerald-500">{right}</div> : null}
    </div>
  );

  const showSubType = selectedTest === "COMPRESSIVE TEST" || selectedTest === "SHEAR TEST";

  return (
    <div className={`flex flex-col h-full ${surface}`}>
      {/* Header (cleaner, compact) */}
      <div className={["h-12 flex items-center justify-between px-3 border-b", border, surface2].join(" ")}>
        <div className="min-w-0">
          <div className={["text-[12px] font-extrabold tracking-widest uppercase", subText].join(" ")}>
            Configure
          </div>
          <div className={["text-[16px] font-extrabold truncate", text].join(" ")}>
            {selectedTest}
          </div>
        </div>

        <button
          onClick={handleClose}
          className={[
            "h-9 w-9 rounded-xl inline-flex items-center justify-center",
            "transition active:scale-[0.98]",
            darkMode ? "hover:bg-white/10" : "hover:bg-black/5",
            text,
          ].join(" ")}
          aria-label="Close"
          title="Close"
        >
          <span className="text-[18px] font-black leading-none">×</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col">
        {/* Specimen Name */}
        <div className={["px-3 py-2 border-b", border].join(" ")}>
          <div className="flex items-center justify-between mb-1">
            <label className={["text-[13px] font-extrabold", text].join(" ")}>
              Specimen Name <span className="text-red-500">*</span>
            </label>
            <span className={["text-[12px] font-semibold", subText].join(" ")}>Required</span>
          </div>

          <input
            type="text"
            value={specimenName}
            onChange={(e) => setSpecimenName(e.target.value)}
            onFocus={(e) => {
              if ("ontouchstart" in window) {
                e.target.blur();
                setTimeout(() => e.target.focus(), 0);
              }
            }}
            placeholder="Enter specimen name"
            data-keyboard="1"
            className={[
              "w-full h-11 px-3 rounded-xl border",
              "text-[16px] font-semibold keyboard-trigger",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/30",
              border,
              darkMode
                ? "bg-gray-950/30 text-gray-100 placeholder-gray-500"
                : "bg-white text-gray-900 placeholder-gray-400",
            ].join(" ")}
          />
        </div>

        {/* Two column layout (same structure, improved styling) */}
        <div className={["flex-1 grid grid-cols-2 border-b", border].join(" ")}>
          {/* LEFT: Sub-type */}
          {showSubType && (
            <div className={["flex flex-col border-r", border].join(" ")}>
              <div className={["px-3 py-2 border-b", border, surface2].join(" ")}>
                <div className="flex items-center justify-between">
                  <div className={["text-[13px] font-extrabold", text].join(" ")}>
                    Test Sub-type <span className="text-red-500">*</span>
                  </div>
                  <div className={["text-[12px] font-semibold", subText].join(" ")}>
                    Required
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                {selectedTest === "COMPRESSIVE TEST" ? (
                  <>
                    <Btn
                      active={subType === "Parallel"}
                      onClick={() => {
                        audio.play();
                        setSubType("Parallel");
                      }}
                      className={["border-b", border].join(" ")}
                    >
                      PARALLEL TO GRAIN
                    </Btn>
                    <Btn
                      active={subType === "Perpendicular"}
                      onClick={() => {
                        audio.play();
                        setSubType("Perpendicular");
                      }}
                    >
                      PERPENDICULAR TO GRAIN
                    </Btn>
                  </>
                ) : (
                  <>
                    <Btn
                      active={subType === "Single"}
                      onClick={() => {
                        audio.play();
                        setSubType("Single");
                      }}
                      className={["border-b", border].join(" ")}
                    >
                      SINGLE SHEAR
                    </Btn>
                    <Btn
                      active={subType === "Double"}
                      onClick={() => {
                        audio.play();
                        setSubType("Double");
                      }}
                    >
                      DOUBLE SHEAR
                    </Btn>
                  </>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: Procedure (or full width if no subtype) */}
          {!showSubType ? (
            <div className="col-span-2 flex flex-col">
              <div className={["px-3 py-2 border-b", border, surface2].join(" ")}>
                <div className={["text-[13px] font-extrabold", text].join(" ")}>Test Procedure</div>
              </div>

              <div className="flex-1 flex flex-col">
                <label
                  className={[
                    "flex-1 flex items-center gap-3 px-3 cursor-pointer",
                    "border-b",
                    border,
                    includeMoisture
                      ? (darkMode ? "bg-blue-500/15" : "bg-blue-600/10")
                      : (darkMode ? "bg-white/5 hover:bg-white/10" : "bg-white hover:bg-gray-50"),
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={includeMoisture}
                    onChange={(e) => {
                      audio.play();
                      setIncludeMoisture(e.target.checked);
                    }}
                    className="w-5 h-5"
                  />
                  <span className={["text-[18px] font-semibold", text].join(" ")}>Moisture Test</span>
                  <span className={["ml-auto text-[12px] font-semibold", subText].join(" ")}>Optional</span>
                </label>

                <RowItem right="✓ Required">Measurement Test</RowItem>
                <RowItem right="✓ Required">Strength Test</RowItem>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className={["px-3 py-2 border-b", border, surface2].join(" ")}>
                <div className={["text-[13px] font-extrabold", text].join(" ")}>Test Procedure</div>
              </div>

              <div className="flex-1 flex flex-col">
                <label
                  className={[
                    "flex-1 flex items-center gap-3 px-3 cursor-pointer",
                    "border-b",
                    border,
                    includeMoisture
                      ? (darkMode ? "bg-blue-500/15" : "bg-blue-600/10")
                      : (darkMode ? "bg-white/5 hover:bg-white/10" : "bg-white hover:bg-gray-50"),
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={includeMoisture}
                    onChange={(e) => {
                      audio.play();
                      setIncludeMoisture(e.target.checked);
                    }}
                    className="w-5 h-5"
                  />
                  <span className={["text-[18px] font-semibold", text].join(" ")}>Moisture Test</span>
                  <span className={["ml-auto text-[12px] font-semibold", subText].join(" ")}>Optional</span>
                </label>

                <RowItem right="✓ Required">Measurement Test</RowItem>
                <RowItem right="✓ Required">Strength Test</RowItem>
              </div>
            </div>
          )}
        </div>

        {/* Start button (cleaner, not shouting with huge padding) */}
        <button
          onClick={handleBeginTest}
          disabled={!isFormValid()}
          className={[
            "h-14",
            "text-[18px] font-extrabold tracking-widest",
            "transition active:scale-[0.99]",
            isFormValid()
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : darkMode
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-200 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          START
        </button>
      </div>
    </div>
  );
};

export default WoodTests;
