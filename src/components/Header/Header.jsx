import React from "react";
import { IoMdMenu } from "react-icons/io";
import { FiSun, FiMoon } from "react-icons/fi";

const Header = ({
  darkMode = false,
  title = "Timber Test Management System",
  subtitle = "",
  onToggleNav = () => {},
  onToggleTheme = () => {},
  rightSlot = null, // optional: inject extra buttons/controls
}) => {
  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50",
        "h-[64px] px-4",
        "flex items-center",
        "border-b",
        darkMode
          ? "bg-gray-900/70 border-gray-800 text-gray-100"
          : "bg-white/70 border-gray-200 text-gray-900",
        "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
      ].join(" ")}
    >
      {/* Left: Menu */}
      <button
        type="button"
        onClick={onToggleNav}
        aria-label="Open menu"
        className={[
          "inline-flex items-center justify-center",
          "h-10 w-10 rounded-xl",
          "transition active:scale-[0.98]",
          darkMode
            ? "text-gray-100 hover:bg-white/10"
            : "text-gray-900 hover:bg-black/5",
        ].join(" ")}
      >
        <IoMdMenu className="text-2xl" />
      </button>

      {/* Center: Title */}
      <div className="ml-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className={[
              "truncate",
              "text-[15px] sm:text-[16px] font-semibold tracking-wide",
            ].join(" ")}
            title={title}
          >
            {title}
          </h1>

          {/* subtle status pill */}
          <span
            className={[
              "hidden sm:inline-flex",
              "px-2 py-0.5 rounded-full text-[11px] font-medium",
              darkMode
                ? "bg-white/10 text-gray-200"
                : "bg-black/5 text-gray-700",
            ].join(" ")}
          >
            Active
          </span>
        </div>

        {subtitle ? (
          <p
            className={[
              "truncate text-[12px]",
              darkMode ? "text-gray-300" : "text-gray-500",
            ].join(" ")}
            title={subtitle}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* Right: Actions */}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Light Mode" : "Dark Mode"}
          className={[
            "inline-flex items-center justify-center",
            "h-10 w-10 rounded-xl",
            "transition active:scale-[0.98]",
            darkMode
              ? "text-gray-100 hover:bg-white/10"
              : "text-gray-900 hover:bg-black/5",
          ].join(" ")}
        >
          {darkMode ? <FiSun className="text-[20px]" /> : <FiMoon className="text-[20px]" />}
        </button>
      </div>
    </header>
  );
};

export default Header;
