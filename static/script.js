let mediaRecorder = null;
let audioChunks = [];

// ฟังก์ชันแสดงหน้าต่างต่างๆ
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });

    const selectedPage = document.getElementById(`${pageId}-page`);
    selectedPage.classList.add('active');
}

