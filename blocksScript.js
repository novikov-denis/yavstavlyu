(function() {
  // Функция для выделения блоков текста
  function highlightBlocks() {
    // Ищем все текстовые блоки внутри .ProseMirror
    const textBlocks = document.querySelectorAll('.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3');

    textBlocks.forEach((block, index) => {
      // Проверяем, не добавлена ли уже кнопка к блоку
      if (!block.querySelector('.copy-button')) {
        // Добавляем выделение цветом для блоков текста
        block.style.backgroundColor = '#f0f0f0';  // Светло-серый фон для выделения

        // Создаем кнопку "Копировать блок"
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Копировать блок';
        copyButton.className = 'copy-button';  // Добавляем класс для идентификации кнопки
        copyButton.style.position = 'absolute';
        copyButton.style.top = '5px';
        copyButton.style.right = '5px';
        copyButton.style.padding = '5px 10px';
        copyButton.style.backgroundColor = '#4caf50';
        copyButton.style.color = '#fff';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '4px';
        copyButton.style.cursor = 'pointer';
        copyButton.style.zIndex = '1000';  // Обеспечиваем, что кнопка отображается поверх других элементов

        // Добавляем действие копирования при нажатии на кнопку
        copyButton.addEventListener('click', () => {
          const blockText = block.innerText;  // Получаем текст блока
          copyToClipboard(blockText);
          alert('Текст блока скопирован!');
        });

        // Оборачиваем блок в контейнер, чтобы кнопка была правильно расположена
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        block.parentNode.insertBefore(wrapper, block);
        wrapper.appendChild(block);
        wrapper.appendChild(copyButton);
      }
    });
  }

  // Функция для копирования текста в буфер обмена
  function copyToClipboard(text) {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);
  }

  // Запускаем функцию выделения блоков
  highlightBlocks();
})();
