import React from "react";
import { Menu, Moon, Sun } from "lucide-react";

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
        <Menu className="h-6 w-6" strokeWidth={2.2} />
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
          {darkMode ? (
            <Sun className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Moon className="h-5 w-5" strokeWidth={2.2} />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
