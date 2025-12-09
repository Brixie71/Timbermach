// GlobalKeyboardProvider.jsx - Wraps your entire app and manages keyboard globally

import React, { createContext, useContext, useState, useEffect } from 'react';
import VirtualKeyboard from './VirtualKeyboard';

// Create context for keyboard state
const KeyboardContext = createContext();

// Custom hook to use keyboard from any component
export const useKeyboard = () => {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within GlobalKeyboardProvider');
  }
  return context;
};

export const GlobalKeyboardProvider = ({ children, darkMode = false }) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentInput, setCurrentInput] = useState(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // Global click handler to detect input focus
    const handleFocusIn = (e) => {
      const target = e.target;
      
      // Check if focused element is an input or has data-keyboard attribute
      if (
        (target.tagName === 'INPUT' && target.type === 'text') ||
        (target.tagName === 'INPUT' && target.type === 'search') ||
        target.hasAttribute('data-keyboard') ||
        target.classList.contains('keyboard-trigger')
      ) {
        // Prevent system keyboard on touch devices
        if ('ontouchstart' in window) {
          target.readOnly = true;
        }
        
        setCurrentInput(target);
        setInputValue(target.value || '');
        setIsKeyboardVisible(true);
        
        // Prevent default keyboard on mobile
        e.preventDefault();
      }
    };

    // Listen for focus events globally
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, []);

  const handleKeyPress = (value) => {
    setInputValue(value);
    
    // Update the actual input element
    if (currentInput) {
      // Get the React internal instance
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      
      // Set the value using native setter
      nativeInputValueSetter.call(currentInput, value);
      
      // Trigger both input and change events for React
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      
      currentInput.dispatchEvent(inputEvent);
      currentInput.dispatchEvent(changeEvent);
    }
  };

  const handleClose = (finalValue) => {
    if (currentInput) {
      // Get the React internal instance
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      
      // Set the value using native setter
      nativeInputValueSetter.call(currentInput, finalValue);
      
      // Trigger both input and change events for React
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      
      currentInput.dispatchEvent(inputEvent);
      currentInput.dispatchEvent(changeEvent);
      
      // Blur the input
      currentInput.blur();
    }
    
    setIsKeyboardVisible(false);
    setCurrentInput(null);
    setInputValue('');
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
      
      {/* Global Keyboard */}
      {isKeyboardVisible && (
        <VirtualKeyboard
          darkMode={darkMode}
          initialValue={inputValue}
          onKeyPress={handleKeyPress}
          onClose={handleClose}
        />
      )}
    </KeyboardContext.Provider>
  );
};

export default GlobalKeyboardProvider;