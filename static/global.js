// global.js - handles dark mode + future global features

document.addEventListener("DOMContentLoaded", function () {
    // Enable dark mode if saved
    if (localStorage.getItem("dark-mode") === "enabled") {
      document.body.classList.add("dark-mode");
    }
  });
  