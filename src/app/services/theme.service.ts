import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ThemeService {
  private isDark = false;
  private _showLegend = true;

  constructor() {
    this.loadTheme();
    this.loadPreferences();
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      this.isDark = true;
      document.body.classList.add("dark-theme");
    } else {
      this.isDark = false;
      document.body.classList.remove("dark-theme");
    }
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    if (this.isDark) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  }

  get isDarkMode() {
    return this.isDark;
  }

  loadPreferences() {
    const savedLegend = localStorage.getItem("showLegend");
    if (savedLegend !== null) {
      this._showLegend = savedLegend === "true";
    }
  }

  toggleLegend() {
    this._showLegend = !this._showLegend;
    localStorage.setItem("showLegend", this._showLegend.toString());
  }

  get showLegend() {
    return this._showLegend;
  }
}
