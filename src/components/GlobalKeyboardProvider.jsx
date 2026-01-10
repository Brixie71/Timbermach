// GlobalKeyboardProvider.jsx - Wraps your entire app and manages keyboard globally

import React, { createContext, useContext, useState, useEffect } from "react";
import VirtualKeyboard from "./VirtualKeyboard";

const KeyboardContext = createContext();

export const useKeyboard = () => {
  const context = useContext(KeyboardContext);
  if (!context) throw new Error("useKeyboard must be used within GlobalKeyboardProvider");
  return context;
};

function getKeyboardModeForTarget(target) {
  const forced = target.getAttribute("data-keyboard-mode");
  if (forced === "numeric" || forced === "text") return forced;

  const inputMode = (target.getAttribute("inputmode") || "").toLowerCase();
  const type = (target.getAttribute("type") || "").toLowerCase();

  if (
    inputMode === "decimal" ||
    inputMode === "numeric" ||
    type === "number" ||
    target.classList.contains("keyboard-numeric")
  ) {
    return "numeric";
  }
  return "text";
}

export const GlobalKeyboardProvider = ({ children, darkMode = false }) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentInput, setCurrentInput] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [keyboardMode, setKeyboardMode] = useState("text");

  useEffect(() => {
    const handleFocusIn = (e) => {
      const target = e.target;

      const isKeyboardTarget =
      (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") &&
      (target?.hasAttribute?.("data-keyboard") || target?.classList?.contains?.("keyboard-trigger"));

      if (!isKeyboardTarget) return;

      // ✅ DO NOT set readOnly. It breaks controlled inputs in React.
      // ✅ Also do NOT preventDefault here; let focus happen normally.

      setCurrentInput(target);
      setInputValue(target.value || "");
      setKeyboardMode(getKeyboardModeForTarget(target));
      setIsKeyboardVisible(true);
    };

    document.addEventListener("focusin", handleFocusIn, true);
    return () => document.removeEventListener("focusin", handleFocusIn, true);
  }, []);

  const syncValueToInput = (value) => {
    if (!currentInput) return;

    // Set DOM value using the native setter (so React can detect it)
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    setter?.call(currentInput, value);

    // ✅ Fire a REAL input event (React-friendly)
    let evt;
    try {
      evt = new InputEvent("input", { bubbles: true });
    } catch {
      evt = document.createEvent("Event");
      evt.initEvent("input", true, true);
    }
    currentInput.dispatchEvent(evt);
  };

  const handleKeyPress = (fullValue) => {
    // VirtualKeyboard sends the FULL string
    setInputValue(fullValue);
    syncValueToInput(fullValue);
  };

  const handleClose = () => {
    if (currentInput) {
      // DO NOT sync here; value is already synced per keypress
      currentInput.blur();
    }
    setIsKeyboardVisible(false);
    setCurrentInput(null);
    setInputValue("");
    setKeyboardMode("text");
  };

  return (
    <KeyboardContext.Provider
      value={{
        showKeyboard: () => setIsKeyboardVisible(true),
        hideKeyboard: () => setIsKeyboardVisible(false),
        isVisible: isKeyboardVisible,
      }}
    >
      {children}

      {isKeyboardVisible && (
        <VirtualKeyboard
          darkMode={darkMode}
          initialValue={inputValue}
          mode={keyboardMode}
          onKeyPress={handleKeyPress}
          onClose={handleClose}
        />
      )}
    </KeyboardContext.Provider>
  );
};

export default GlobalKeyboardProvider;
