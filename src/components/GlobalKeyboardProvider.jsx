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

  const isKeyboardTarget = (target) =>
    (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") &&
    (target?.hasAttribute?.("data-keyboard") ||
      target?.classList?.contains?.("keyboard-trigger"));

  useEffect(() => {
    const handleFocusIn = (e) => {
      const target = e.target;

      if (!isKeyboardTarget(target)) return;

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

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!isKeyboardVisible) return;

      const target = e.target;
      const insideKeyboard = target?.closest?.("[data-virtual-keyboard]");

      if (insideKeyboard || isKeyboardTarget(target)) return;

      if (currentInput) currentInput.blur();
      setIsKeyboardVisible(false);
      setCurrentInput(null);
      setInputValue("");
      setKeyboardMode("text");
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isKeyboardVisible, currentInput]);

  const syncValueToInput = (value) => {
    if (!currentInput) return;

    // Set DOM value using the native setter (so React can detect it)
    const proto =
      currentInput instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(currentInput, value);

    // Fire input + change so React consistently picks it up across environments.
    try {
      currentInput.dispatchEvent(new Event("input", { bubbles: true }));
      currentInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      const evt = document.createEvent("Event");
      evt.initEvent("input", true, true);
      currentInput.dispatchEvent(evt);
      const changeEvt = document.createEvent("Event");
      changeEvt.initEvent("change", true, true);
      currentInput.dispatchEvent(changeEvt);
    }
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
