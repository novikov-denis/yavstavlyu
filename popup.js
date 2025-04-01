document.getElementById('scanButton').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    // Проверяем, что URL вкладки начинается с http:// или https://
    if (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')) {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, () => {
        // Показываем уведомление об успешном копировании
        const notification = document.getElementById('notification');
        notification.style.display = 'block';
        setTimeout(() => {
          notification.style.display = 'none';
        }, 3000);
      });
    } else {
      alert('Это расширение не может работать на этой странице.');
    }
  });
});

// Новый обработчик для второй кнопки
document.getElementById('blockButton').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    // Проверяем, что URL вкладки содержит домен yonote.ru
    if (activeTab.url.includes('yonote.ru')) {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['copySelection.js'] // Новый скрипт
      }, () => {
        const notification = document.getElementById('notification');
        notification.style.display = 'block';
        setTimeout(() => {
          notification.style.display = 'none';
        }, 3000);
      });
    } else {
      alert('Этот скрипт работает только на сайте Yonote.');
    }
  });
});


// Обработчик для кнопки копирования квиза
document.getElementById('quizButton').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')) {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['copyquiz.js']
      });
    } else {
      alert('Это расширение не может работать на этой странице.');
    }
  });
});
