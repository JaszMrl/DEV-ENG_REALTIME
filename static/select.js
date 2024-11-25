// Function to select difficulty level
function selectDifficulty(level) {
    const difficultyPage = document.getElementById('difficulty-page');
    difficultyPage.classList.remove('active');

    const modePages = document.querySelectorAll('.mode-page');
    modePages.forEach(page => {
        page.classList.remove('active');
    });

    const selectedPage = document.getElementById(`${level}-page`);
    selectedPage.classList.add('active');
}

// Function to select difficulty level
function selectDifficulty(level) {
    // Hide difficulty selection page
    const difficultyPage = document.getElementById('difficulty-page');
    difficultyPage.classList.remove('active');

    // Hide all mode pages first
    const modePages = document.querySelectorAll('.mode-page');
    modePages.forEach(page => {
        page.classList.remove('active');
    });

    // Show the selected mode page
    const selectedPage = document.getElementById(`${level}-page`);
    if (selectedPage) {
        selectedPage.classList.add('active');
    } else {
        console.error(`Page for difficulty level '${level}' not found.`);
    }
}

function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(button => button.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

