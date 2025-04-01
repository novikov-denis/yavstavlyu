(function() {
  // Функция для генерации UUID (v4)
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Функция перемешивания массива (алгоритм Фишера–Йетса)
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // --- Часть 1. Преобразование выделенного DOM в Markdown ---
  let markdownContent = "";

  function processSelection(selection) {
    markdownContent = "";
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);
    traverse(container, 0);
  }

  function processElement(element, indentLevel = 0) {
    const tagName = element.tagName.toLowerCase();
    if (['h1','h2','h3','h4','h5','h6'].includes(tagName)) {
      const level = parseInt(tagName.substring(1));
      const prefix = '#'.repeat(level) + ' ';
      const text = processChildNodes(element, true).trim();
      markdownContent += '\n' + '  '.repeat(indentLevel) + prefix + text + '\n\n';
      return;
    }
    if (tagName === 'p') {
      const text = processChildNodes(element);
      if (text) {
        markdownContent += '  '.repeat(indentLevel) + text + '\n\n';
      }
      return;
    }
    if (tagName === 'div' && element.classList.contains('table-wrapper')) {
      const table = element.querySelector('table');
      if (table) {
        markdownContent += convertTableToMarkdown(table, indentLevel) + '\n\n';
      }
      return;
    }
    if (tagName === 'div' && element.classList.contains('code-block')) {
      const language = element.getAttribute('data-language') || '';
      const codeElement = element.querySelector('pre > code');
      if (codeElement) {
        const codeText = codeElement.textContent.trim();
        markdownContent += '\n' + '  '.repeat(indentLevel) + "```" + language + "\n" + codeText + "\n```" + "\n\n";
      }
      return;
    }
    element.childNodes.forEach(child => {
      traverse(child, indentLevel);
    });
  }

  function processChildNodes(node, ignoreFormatting = false) {
    let textContent = "";
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        textContent += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const nodeName = child.tagName.toLowerCase();
        let childText = "";
        switch(nodeName) {
          case 'strong':
          case 'b':
            childText = processChildNodes(child, ignoreFormatting);
            textContent += ignoreFormatting ? childText : `**${childText.trim()}**`;
            break;
          case 'em':
          case 'i':
            childText = processChildNodes(child, ignoreFormatting);
            textContent += ignoreFormatting ? childText : `*${childText.trim()}*`;
            break;
          case 'code':
            childText = child.textContent;
            textContent += '`' + childText + '`';
            break;
          case 'a':
            const href = child.getAttribute('href');
            childText = processChildNodes(child).trim();
            if (href && childText) {
              textContent += `[${childText}](${href}){target="_blank"}`;
            } else {
              textContent += childText;
            }
            break;
          default:
            childText = processChildNodes(child, ignoreFormatting);
            textContent += childText;
            break;
        }
      }
    });
    return textContent;
  }

  function traverse(node, indentLevel = 0) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (['p','div','h1','h2','h3','h4','h5','h6','ol','ul','table','tr','td','th'].includes(tagName)) {
        processElement(node, indentLevel);
      } else {
        const text = processChildNodes(node);
        if (text) {
          markdownContent += text;
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        markdownContent += text;
      }
    }
  }

  function convertTableToMarkdown(table, indentLevel) {
    let markdown = "";
    const rows = table.querySelectorAll('tr');
    const markdownRows = [];
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll('th, td');
      const rowArray = [];
      cells.forEach(cell => {
        const cellText = processChildNodes(cell).trim();
        rowArray.push(cellText);
      });
      markdownRows.push(rowArray);
    });
    if (markdownRows.length > 0) {
      const header = markdownRows[0];
      const separator = header.map(() => '---');
      markdown += '  '.repeat(indentLevel) + "| " + header.join(" | ") + " |\n";
      markdown += '  '.repeat(indentLevel) + "| " + separator.join(" | ") + " |\n";
      for (let i = 1; i < markdownRows.length; i++) {
        markdown += '  '.repeat(indentLevel) + "| " + markdownRows[i].join(" | ") + " |\n";
      }
    }
    return markdown;
  }

  // --- Часть 2. Извлечение данных квиза из Markdown и формирование JSON ---
  function processQuizMacaroniFromMarkdown(mdText) {
    const lines = mdText.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (!lines[0].toLowerCase().includes('квиз-макароны')) {
      return null;
    }
    // Всё, что идёт до начала таблицы (строки, начинающиеся с "|") – это часть вопроса
    let questionLines = [];
    let currentIndex = 1;
    while (currentIndex < lines.length && !lines[currentIndex].startsWith('|')) {
      questionLines.push(lines[currentIndex]);
      currentIndex++;
    }
    const question = questionLines.join("\n");

    // Извлекаем строки таблицы
    let mdRows = [];
    while (currentIndex < lines.length && lines[currentIndex].startsWith('|')) {
      mdRows.push(lines[currentIndex]);
      currentIndex++;
    }
    if (mdRows.length < 3) {
      return null;
    }
    let leftChoices = [];
    let rightChoices = [];
    for (let i = 2; i < mdRows.length; i++) {
      let row = mdRows[i];
      if (row.startsWith('|') && row.endsWith('|')) {
        row = row.slice(1, -1);
      }
      let parts = row.split('|').map(part => part.trim());
      if (parts.length >= 2) {
        leftChoices.push(parts[0]);
        rightChoices.push(parts[1]);
      }
    }

    // Извлекаем фидбек – строка, начинающаяся с "Фидбек:" или "**Фидбек:**"
    let feedback = "";
    while (currentIndex < lines.length) {
      const lower = lines[currentIndex].toLowerCase();
      if (lower.startsWith('фидбек:') || lower.startsWith('**фидбек:**')) {
        feedback = lines[currentIndex].replace(/^\*?\*?фидбек:\*?\*?/i, '').trim();
        currentIndex++;
        while (currentIndex < lines.length && lines[currentIndex] !== '') {
          feedback += " " + lines[currentIndex];
          currentIndex++;
        }
        break;
      }
      currentIndex++;
    }

    // Формируем объект квиза
    const quiz = {
      content: {
        id: generateUUID(),
        options: {
          left: {
            choices: leftChoices
          },
          right: {
            choices: rightChoices
          }
        },
        feedback: feedback,
        isPasted: true,
        question: question.replace(/`/g, ''),
        button_text: "Ответить",
        correct_answers: [
          leftChoices.map((choice, index) => [index, index])
        ],
        meta: {}
      },
      type: "QuizMacaroni"
    };

    // Перемешиваем правую часть
    const originalRight = quiz.content.options.right.choices.slice();
    const indices = originalRight.map((_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newRight = indices.map(i => originalRight[i]);
    quiz.content.options.right.choices = newRight;
    const newCorrectMapping = indices.map((originalIndex, newIndex) => [originalIndex, newIndex]);
    quiz.content.correct_answers = [ newCorrectMapping ];

    return quiz;
  }

  // --- Часть 3. Копирование JSON в буфер обмена и вывод уведомления ---
  function copyToClipboard(text) {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.style.position = 'fixed';
    tempTextArea.style.top = '0';
    tempTextArea.style.left = '0';
    tempTextArea.style.width = '1px';
    tempTextArea.style.height = '1px';
    tempTextArea.style.opacity = '0';
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Ошибка при копировании текста:', err);
    }
    document.body.removeChild(tempTextArea);
  }

  function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.backgroundColor = type === 'success' ? '#4caf50' : '#f44336';
    toast.style.color = '#fff';
    toast.style.padding = '16px';
    toast.style.borderRadius = '2px';
    toast.style.fontSize = '17px';
    toast.style.zIndex = '10000';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }

  // --- Основная функция: получение выделённого DOM, преобразование в Markdown и обработка квиза ---
  function copySelectedTextAsQuiz() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        showNotification('Сначала выделите текст квиза на странице.', 'error');
        return;
      }
      processSelection(selection);
      const mdText = markdownContent.trim();
      console.log("Markdown, полученный из выделения:", mdText);

      const quiz = processQuizMacaroniFromMarkdown(mdText);
      if (quiz) {
        const quizJson = JSON.stringify(quiz, null, 2);
        copyToClipboard(quizJson);
        console.log('Содержимое квиза (JSON):', quizJson);
        showNotification('Квиз успешно скопирован в буфер обмена!', 'success');
        return;
      } else {
        showNotification('Не удалось обработать квиз.', 'error');
        return;
      }
    } catch (error) {
      console.error('Ошибка при копировании квиза:', error);
      showNotification('Произошла ошибка при выполнении скрипта.', 'error');
    }
  }

  // Запускаем основную функцию (этот файл вызывается кнопкой из popup.js)
  copySelectedTextAsQuiz();
})();
