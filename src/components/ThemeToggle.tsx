import React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../lib/theme-context";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="w-5 h-5" />;
      case "dark":
        return <Moon className="w-5 h-5" />;
      case "system":
        return <Monitor className="w-5 h-5" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "system":
        return "System";
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      className="gap-2"
      title={`Current theme: ${getLabel()}`}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </Button>
  );
};
