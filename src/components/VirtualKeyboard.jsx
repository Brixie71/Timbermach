// VirtualKeyboard.jsx - On-screen keyboard for touchscreen devices

import React, { useState, useEffect } from 'react';

const VirtualKeyboard = ({ onKeyPress, onClose, darkMode = false, initialValue = '' }) => {
  const [input, setInput] = useState(initialValue);
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);

  const keys = {
    row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    row2: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    row3: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    row4: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  };

  const specialChars = {
    row1: ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
    row2: ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
    row3: [';', ':', '\'', '"', ',', '.', '<', '>', '/', '?'],
    row4: ['`', '~', '€', '£', '¥', '₱', '°', '•', '±', '§'],
  };

  const handleKeyPress = (key) => {
    let processedKey = key;

    // Apply shift/caps lock
    if (isShift || isCapsLock) {
      processedKey = key.toUpperCase();
    }

    const newInput = input + processedKey;
    setInput(newInput);
    
    if (onKeyPress) {
      onKeyPress(newInput);
    }

    // Reset shift after key press
    if (isShift) {
      setIsShift(false);
    }
  };

  const handleBackspace = () => {
    const newInput = input.slice(0, -1);
    setInput(newInput);
    
    if (onKeyPress) {
      onKeyPress(newInput);
    }
  };

  const handleSpace = () => {
    const newInput = input + ' ';
    setInput(newInput);
    
    if (onKeyPress) {
      onKeyPress(newInput);
    }
  };

  const handleClear = () => {
    setInput('');
    if (onKeyPress) {
      onKeyPress('');
    }
  };

  const handleEnter = () => {
    if (onClose) {
      onClose(input);
    }
  };

  const toggleShift = () => {
    setIsShift(!isShift);
  };

  const toggleCapsLock = () => {
    setIsCapsLock(!isCapsLock);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${
      darkMode ? 'bg-gray-800 border-t-2 border-gray-700' : 'bg-gray-100 border-t-2 border-gray-300'
    }`}>
      {/* Input Display */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
        <div className={`text-lg font-mono ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {input || <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>Type here...</span>}
        </div>
      </div>

      {/* Keyboard Keys */}
      <div className="p-2">
        {/* Row 1 - Numbers or Special Chars */}
        <div className="flex gap-1 mb-1 justify-center">
          {(showSpecialChars ? specialChars.row1 : keys.row1).map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex-1 max-w-[60px] py-3 text-sm font-semibold transition-colors ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Row 2 - Letters or Special Chars */}
        <div className="flex gap-1 mb-1 justify-center">
          {(showSpecialChars ? specialChars.row2 : keys.row2).map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex-1 max-w-[60px] py-3 text-sm font-semibold transition-colors ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              {showSpecialChars ? key : (isShift || isCapsLock ? key.toUpperCase() : key)}
            </button>
          ))}
        </div>

        {/* Row 3 - Letters or Special Chars */}
        <div className="flex gap-1 mb-1 justify-center">
          {(showSpecialChars ? specialChars.row3 : keys.row3).map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex-1 max-w-[60px] py-3 text-sm font-semibold transition-colors ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              {showSpecialChars ? key : (isShift || isCapsLock ? key.toUpperCase() : key)}
            </button>
          ))}
        </div>

        {/* Row 4 - Letters/Special Chars with Shift */}
        <div className="flex gap-1 mb-1 justify-center">
          {!showSpecialChars && (
            <button
              onClick={toggleShift}
              className={`px-4 py-3 text-xs font-semibold transition-colors ${
                isShift
                  ? darkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              ⇧ Shift
            </button>
          )}
          {(showSpecialChars ? specialChars.row4 : keys.row4).map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex-1 max-w-[60px] py-3 text-sm font-semibold transition-colors ${
                darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              {showSpecialChars ? key : (isShift || isCapsLock ? key.toUpperCase() : key)}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className={`px-4 py-3 text-xs font-semibold transition-colors ${
              darkMode
                ? 'bg-red-700 text-white hover:bg-red-600 active:bg-red-500'
                : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 border border-red-600'
            }`}
          >
            ⌫ Back
          </button>
        </div>

        {/* Bottom Row - Special buttons */}
        <div className="flex gap-1">
          {!showSpecialChars && (
            <button
              onClick={toggleCapsLock}
              className={`px-4 py-3 text-xs font-semibold transition-colors ${
                isCapsLock
                  ? darkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : darkMode
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
              }`}
            >
              ⇪ Caps
            </button>
          )}
          <button
            onClick={() => setShowSpecialChars(!showSpecialChars)}
            className={`px-4 py-3 text-xs font-semibold transition-colors ${
              showSpecialChars
                ? darkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : darkMode
                ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
            }`}
          >
            {showSpecialChars ? 'ABC' : '#+='}
          </button>
          <button
            onClick={handleClear}
            className={`px-4 py-3 text-xs font-semibold transition-colors ${
              darkMode
                ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
            }`}
          >
            Clear
          </button>
          <button
            onClick={handleSpace}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              darkMode
                ? 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-500'
                : 'bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-300'
            }`}
          >
            Space
          </button>
          <button
            onClick={handleEnter}
            className={`px-6 py-3 text-xs font-semibold transition-colors ${
              darkMode
                ? 'bg-green-700 text-white hover:bg-green-600 active:bg-green-500'
                : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700 border border-green-600'
            }`}
          >
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;