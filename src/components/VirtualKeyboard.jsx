import React, { useEffect, useRef, useState } from "react";

const VirtualKeyboard = ({
  onKeyPress,
  onClose,
  darkMode = false,
  initialValue = "",
  mode = "text", // "text" | "numeric"
}) => {
  const [input, setInput] = useState(initialValue);
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);

  // Hold-to-clear protection
  const clearHoldTimer = useRef(null);
  const [clearHolding, setClearHolding] = useState(false);

  // ✅ Spam-proof: throttle updates to provider (GlobalKeyboardProvider) to 1 per frame
  const rafPending = useRef(false);
  const lastVal = useRef(initialValue || "");

  useEffect(() => {
    setInput(initialValue || "");
    lastVal.current = initialValue || "";
  }, [initialValue]);

  const emitToProvider = (val) => {
    if (!onKeyPress) return;
    lastVal.current = val;

    if (rafPending.current) return;
    rafPending.current = true;

    requestAnimationFrame(() => {
      rafPending.current = false;
      onKeyPress(lastVal.current);
    });
  };

  const keys = {
    row1: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    row2: ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    row3: ["z", "x", "c", "v", "b", "n", "m"],
  };

  const numbersRow = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  const specialChars = {
    row1: ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    row2: ["-", "_", "=", "+", "[", "]", "{", "}", "\\", "|"],
    row3: [";", ":", "'", '"', ",", ".", "<", ">", "/", "?"],
  };

  const numericPad = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    ["0", ".", "-"],
  ];

  const applyCase = (k) => {
    if (showSpecialChars) return k;
    if (mode === "numeric") return k;
    return isShift || isCapsLock ? k.toUpperCase() : k;
  };

  const pushValue = (newValue) => {
    setInput(newValue);
    emitToProvider(newValue);
  };

  const handleKeyTap = (key) => {
    const processed = applyCase(key);

    setInput((prev) => {
      const next = prev + processed;
      emitToProvider(next);
      return next;
    });

    if (isShift) setIsShift(false);
  };

  const handleBackspace = () => {
    setInput((prev) => {
      const next = prev.slice(0, -1);
      emitToProvider(next);
      return next;
    });
  };

  const handleSpace = () => {
    setInput((prev) => {
      const next = prev + " ";
      emitToProvider(next);
      return next;
    });
  };

  const handleDone = () => {
    onClose?.(input);
  };

  // ✅ HOLD-TO-CLEAR (700ms) to prevent accidental wiping
  const startHoldClear = () => {
    setClearHolding(true);
    clearHoldTimer.current = setTimeout(() => {
      pushValue("");
      setClearHolding(false);
      clearHoldTimer.current = null;
    }, 700);
  };

  const endHoldClear = () => {
    if (clearHoldTimer.current) {
      clearTimeout(clearHoldTimer.current);
      clearHoldTimer.current = null;
    }
    setClearHolding(false);
  };

  const baseKey =
    "select-none rounded-md font-extrabold transition-colors active:scale-[0.99]";
  const keyStyle = darkMode
    ? "bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500"
    : "bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300";

  const funcKeyStyle = darkMode
    ? "bg-gray-800 text-gray-100 hover:bg-gray-700 active:bg-gray-600"
    : "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300";

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 ${
        darkMode
          ? "bg-gray-800 border-t-2 border-gray-700"
          : "bg-gray-100 border-t-2 border-gray-300"
      }`}
    >
      {/* Input display */}
      <div
        className={`px-4 py-2 border-b ${
          darkMode ? "border-gray-700" : "border-gray-300"
        }`}
      >
        <div
          className={`text-[16px] font-mono ${
            darkMode ? "text-gray-100" : "text-gray-900"
          }`}
        >
          {input || (
            <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
              Type here…
            </span>
          )}
        </div>
      </div>

      <div className="p-2">
        {/* ================= NUMERIC MODE ================= */}
        {mode === "numeric" ? (
          <div className="grid grid-cols-[1fr_130px] gap-2">
            <div className="grid gap-1">
              {numericPad.map((row, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-1">
                  {row.map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKeyTap(k)}
                      className={`${baseKey} ${keyStyle} h-[52px] text-[18px]`}
                      type="button"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-1 mt-1">
                <button
                  onClick={handleBackspace}
                  className={`${baseKey} ${
                    darkMode
                      ? "bg-red-700 text-white hover:bg-red-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  } h-[50px] text-[14px]`}
                  type="button"
                >
                  ⌫ Backspace
                </button>

                <button
                  onClick={handleDone}
                  className={`${baseKey} ${
                    darkMode
                      ? "bg-green-700 text-white hover:bg-green-600"
                      : "bg-green-500 text-white hover:bg-green-600"
                  } h-[50px] text-[14px]`}
                  type="button"
                >
                  ✓ Done
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <button
                onClick={() => handleKeyTap("+")}
                className={`${baseKey} ${funcKeyStyle} h-[52px] text-[16px]`}
                type="button"
                title="Plus"
              >
                +
              </button>

              <button
                onClick={() => handleKeyTap("e")}
                className={`${baseKey} ${funcKeyStyle} h-[52px] text-[14px]`}
                type="button"
                title="Scientific notation (e)"
              >
                e
              </button>

              {/* Hold to clear */}
              <button
                onPointerDown={startHoldClear}
                onPointerUp={endHoldClear}
                onPointerLeave={endHoldClear}
                onMouseDown={startHoldClear}
                onMouseUp={endHoldClear}
                onMouseLeave={endHoldClear}
                className={`${baseKey} ${
                  clearHolding
                    ? darkMode
                      ? "bg-yellow-600 text-black"
                      : "bg-yellow-400 text-black"
                    : darkMode
                      ? "bg-gray-700 text-gray-100 hover:bg-gray-600"
                      : "bg-white text-gray-900 hover:bg-gray-200 border border-gray-300"
                } h-[108px] text-[13px] whitespace-pre-line`}
                type="button"
                title="Hold to clear (safety)"
              >
                {clearHolding ? "KEEP HOLDING…" : "HOLD\nTO\nCLEAR"}
              </button>
            </div>
          </div>
        ) : (
          /* ================= TEXT MODE ================= */
          <>
            <div className="flex gap-1 mb-1 justify-center">
              {numbersRow.map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeyTap(k)}
                  className={`${baseKey} ${keyStyle} flex-1 h-[44px] text-[14px]`}
                  type="button"
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="flex gap-1 mb-1 justify-center">
              {(showSpecialChars ? specialChars.row1 : keys.row1).map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeyTap(k)}
                  className={`${baseKey} ${keyStyle} flex-1 h-[44px] text-[14px]`}
                  type="button"
                >
                  {showSpecialChars ? k : applyCase(k)}
                </button>
              ))}
            </div>

            <div className="flex gap-1 mb-1 justify-center">
              {(showSpecialChars ? specialChars.row2 : keys.row2).map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeyTap(k)}
                  className={`${baseKey} ${keyStyle} flex-1 h-[44px] text-[14px]`}
                  type="button"
                >
                  {showSpecialChars ? k : applyCase(k)}
                </button>
              ))}
            </div>

            <div className="flex gap-1 mb-1 justify-center">
              <button
                onClick={() => setIsShift((v) => !v)}
                className={`${baseKey} ${
                  isShift
                    ? darkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : funcKeyStyle
                } h-[44px] px-3 text-[12px]`}
                type="button"
              >
                ⇧ Shift
              </button>

              {(showSpecialChars ? specialChars.row3 : keys.row3).map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeyTap(k)}
                  className={`${baseKey} ${keyStyle} flex-1 h-[44px] text-[14px]`}
                  type="button"
                >
                  {showSpecialChars ? k : applyCase(k)}
                </button>
              ))}

              <button
                onClick={handleBackspace}
                className={`${baseKey} ${
                  darkMode
                    ? "bg-red-700 text-white hover:bg-red-600"
                    : "bg-red-500 text-white hover:bg-red-600"
                } h-[44px] px-3 text-[12px]`}
                type="button"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setIsCapsLock((v) => !v)}
                className={`${baseKey} ${
                  isCapsLock
                    ? darkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : funcKeyStyle
                } h-[46px] px-3 text-[12px]`}
                type="button"
              >
                ⇪ Caps
              </button>

              <button
                onClick={() => setShowSpecialChars((v) => !v)}
                className={`${baseKey} ${
                  showSpecialChars
                    ? darkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : funcKeyStyle
                } h-[46px] px-3 text-[12px]`}
                type="button"
              >
                {showSpecialChars ? "ABC" : "#+="}
              </button>

              <button
                onPointerDown={startHoldClear}
                onPointerUp={endHoldClear}
                onPointerLeave={endHoldClear}
                onMouseDown={startHoldClear}
                onMouseUp={endHoldClear}
                onMouseLeave={endHoldClear}
                className={`${baseKey} ${
                  clearHolding
                    ? darkMode
                      ? "bg-yellow-600 text-black"
                      : "bg-yellow-400 text-black"
                    : funcKeyStyle
                } h-[46px] px-3 text-[12px]`}
                type="button"
                title="Hold to clear (safety)"
              >
                {clearHolding ? "Holding…" : "Hold Clear"}
              </button>

              <button
                onClick={handleSpace}
                className={`${baseKey} ${keyStyle} flex-1 h-[46px] text-[14px]`}
                type="button"
              >
                Space
              </button>

              <button
                onClick={handleDone}
                className={`${baseKey} ${
                  darkMode
                    ? "bg-green-700 text-white hover:bg-green-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                } h-[46px] px-4 text-[12px]`}
                type="button"
              >
                ✓ Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualKeyboard;
