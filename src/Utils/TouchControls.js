// TouchControls.js - Touch gesture handler for the app

import { useEffect, useRef } from 'react';

/**
 * Custom hook for handling touch gestures
 * Supports: swipe, tap, long press, pinch zoom
 */
export const useTouchControls = (options = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onLongPress,
    onPinchZoom,
    swipeThreshold = 50,
    longPressDelay = 500,
  } = options;

  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const touchEnd = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimer = useRef(null);
  const initialDistance = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Handle pinch zoom
      if (e.touches.length === 2 && onPinchZoom) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance.current = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      }

      // Start long press timer
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          onLongPress(touch);
        }, longPressDelay);
      }
    };

    const handleTouchMove = (e) => {
      // Cancel long press on move
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Handle pinch zoom
      if (e.touches.length === 2 && onPinchZoom) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const scale = currentDistance / initialDistance.current;
        onPinchZoom(scale);
      }
    };

    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Cancel long press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = touchEnd.current.y - touchStart.current.y;
      const deltaTime = touchEnd.current.time - touchStart.current.time;

      // Check if it's a tap (small movement, quick)
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 300) {
        if (onTap) {
          onTap(touch);
        }
        return;
      }

      // Determine swipe direction
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > swipeThreshold || absY > swipeThreshold) {
        if (absX > absY) {
          // Horizontal swipe
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight();
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown();
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp();
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onLongPress,
    onPinchZoom,
    swipeThreshold,
    longPressDelay,
  ]);
};

/**
 * Higher-order component to add touch controls to any component
 */
export const withTouchControls = (Component, touchOptions) => {
  return (props) => {
    useTouchControls(touchOptions);
    return <Component {...props} />;
  };
};

/**
 * Utility to prevent default touch behaviors
 */
export const preventDefaultTouch = (element) => {
  if (element) {
    element.addEventListener('touchstart', (e) => e.preventDefault(), {
      passive: false,
    });
    element.addEventListener('touchmove', (e) => e.preventDefault(), {
      passive: false,
    });
  }
};

/**
 * Utility to enable smooth scrolling on touch
 */
export const enableTouchScroll = (element) => {
  if (element) {
    element.style.overflowY = 'auto';
    element.style.WebkitOverflowScrolling = 'touch';
  }
};

export default useTouchControls;