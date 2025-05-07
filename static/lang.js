// lang.js - Global language support

const translations = {
    en: {
      // Sidebar
      dashboard: "Dashboard",
      user: "User",
      settings: "Settings",
      speech_test: "Speech Test",
      learn: "Learn",
      admin: "Admin",
  
      // Settings Page
      settings_title: "⚙️ Settings",
      theme_mode: "🌗 Theme Mode",
      language_pref: "🌍 Language Preferences",
      feedback_label: "💡 Feedback & Suggestions",
      save_btn: "Save",
      send_btn: "Send",
      recent_activity: "Recent Activity",
      last_test: "Last test:",
      your_score: "Your Score:",
      your_level: "Your Level:",
      all_levels_completed: "All Levels Completed",
      current_streak: "Current Streak",
      overall_accuracy: "Your Overall Accuracy:",
    },
    th: {
      // Sidebar
      dashboard: "แผงควบคุม",
      user: "ผู้ใช้",
      settings: "การตั้งค่า",
      speech_test: "ทดสอบเสียง",
      learn: "เรียนรู้",
      admin: "ผู้ดูแลระบบ",
  
      // Settings Page
      settings_title: "⚙️ การตั้งค่า",
      theme_mode: "🌗 โหมดธีม",
      language_pref: "🌍 การตั้งค่าภาษา",
      feedback_label: "💡 ข้อเสนอแนะและคำติชม",
      save_btn: "บันทึก",
      send_btn: "ส่ง",

      recent_activity: "กิจกรรมล่าสุด",
      last_test: "การทดสอบล่าสุด:",
      your_score: "คะแนนของคุณ:",
      your_level: "ระดับของคุณ:",
      all_levels_completed: "เรียนจบทุกระดับแล้ว",
      current_streak: "จำนวนวันที่ทำต่อเนื่อง",
      overall_accuracy: "ความแม่นยำรวมของคุณ:",
    }
  };
  
  function applyTranslations(lang) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (translations[lang] && translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const lang = localStorage.getItem("app-language") || "en";
    applyTranslations(lang);
  });
  