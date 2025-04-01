(function() {
  function copySelectedTextAsMarkdown() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        showNotification('Сначала выделите текст на странице.', 'error');
        return;
      }

      // Глобальная переменная для накопления Markdown-контента
      let markdownContent = '';

      // Функция для обработки выделенного текста
      function processSelection(selection) {
        markdownContent = '';

        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const container = document.createElement('div');
        container.appendChild(fragment);

        // Рекурсивная функция для обхода DOM
        traverse(container);
      }

      // Функция для проверки наличия класса, содержащего "background-color"
      function hasBackgroundColorClass(element) {
        return Array.from(element.classList).some(cls => cls.includes('background-color'));
      }

      // Функция для обработки содержимого элемента
      function processElement(element, indentLevel = 0) {
        const tagName = element.tagName.toLowerCase();

        // Обработка заголовков
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const level = parseInt(tagName.substring(1));
          const prefix = '#'.repeat(level) + ' ';
          const text = processChildNodes(element, true); // ignoreFormatting = true
          markdownContent += `\n${'  '.repeat(indentLevel)}${prefix}${text}\n\n`;
          return;
        }

        // Обработка параграфов
        if (tagName === 'p') {
          if (hasBackgroundColorClass(element)) {
            const text = processChildNodes(element);
            markdownContent += `{quiz-task}\n    background: |\n        #f5f6f7\n    content: |\n        ${text}\n{/quiz-task}\n\n`;
            return;
          }

          // Проверяем, содержит ли <p> несколько <mark class="mark_cyan mark">
          const marks = element.querySelectorAll('mark.mark_cyan.mark');
          if (marks.length > 0) {
            let combinedContent = '';
            marks.forEach(mark => {
              combinedContent += processChildNodes(mark) + ' ';
            });
            combinedContent = combinedContent.trim();
            markdownContent += `{quiz-task}\n    background: |\n        #f5f6f7\n    content: |\n        ${combinedContent}\n{/quiz-task}\n\n`;
            return;
          }

          const text = processChildNodes(element);
          if (text) {
            markdownContent += `${'  '.repeat(indentLevel)}${text}\n\n`;
          }
          return;
        }

        // Обработка списков
        if (tagName === 'ol' || tagName === 'ul') {
          const isOrdered = (tagName === 'ol');
          let index = 1;
          element.childNodes.forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
              processListItem(child, isOrdered, indentLevel, index);
              index++;
            }
          });
          return;
        }

        // Обработка элементов списка
        if (tagName === 'li') {
          processListItem(element, false, indentLevel);
          return;
        }

        // Обработка формул
        if ((tagName === 'math-inline' || tagName === 'math-block') && element.classList.contains('math-node')) {
          const latex = extractLatex(element);
          if (latex) {
            // Проверка, если формула находится внутри абзаца
            const parentTag = element.parentElement.tagName.toLowerCase();
            if (parentTag === 'p') {
              // Если внутри абзаца, не добавляем перенос строки
              markdownContent += `{formula}${latex}{/formula}`;
            } else {
              // Если формула отдельно, добавляем переносы строк
              markdownContent += `\n{formula}${latex}{/formula}\n`;
            }
          }
          return;
        }

        // Обработка блочного кода
        if (tagName === 'div' && element.classList.contains('code-block')) {
          const language = element.getAttribute('data-language') || '';
          const codeElement = element.querySelector('pre > code');
          if (codeElement) {
            const codeText = codeElement.textContent.trim();
            markdownContent += `\n${'  '.repeat(indentLevel)}\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
          }
          return;
        }

        // Обработка таблиц
        if (tagName === 'div' && element.classList.contains('table-wrapper')) {
          const table = element.querySelector('table');
          if (table) {
            const markdownTable = convertTableToMarkdown(table, indentLevel);
            markdownContent += `${markdownTable}\n\n`;
          }
          return;
        }

        // Обработка изображений
        if (tagName === 'img') {
          if (!element.closest('math-inline, math-block')) {
            const src = element.getAttribute('src');
            if (src) {
              const alt = element.getAttribute('alt') || '';
              const imgMarkdown = `![${alt}](${src}){target="_blank"}`;
              markdownContent += `${'  '.repeat(indentLevel)}${imgMarkdown}\n\n`;
            }
          }
          return;
        }

        // Обработка ссылок
        if (tagName === 'a') {
          // Проверяем, является ли ссылка вложением (attachment)
          if (element.classList.contains('widget') && element.closest('.component-attachment')) {
            const href = element.getAttribute('href');
            const attachmentTextElement = element.querySelector('p.sc-14fknwk-3');
            const attachmentText = attachmentTextElement ? attachmentTextElement.textContent.trim() : 'Ссылка';
            const attachmentMarkdown = `[${attachmentText}](${href}){target="_blank"}`;
            markdownContent += `${'  '.repeat(indentLevel)}${attachmentMarkdown}\n\n`;
            return;
          }

          // Проверяем, что ссылка не содержит формулу или изображение внутри
          if (element.querySelector('math-inline, math-block, img')) {
            markdownContent += processChildNodes(element);
          } else {
            const href = element.getAttribute('href');
            const linkText = processChildNodes(element).trim();
            if (href && linkText) {
              const linkMarkdown = `[${linkText}](${href}){target="_blank"}`;
              markdownContent += `${'  '.repeat(indentLevel)}${linkMarkdown}\n\n`;
            } else {
              const linkTextOnly = processChildNodes(element).trim();
              if (linkTextOnly) {
                markdownContent += `${'  '.repeat(indentLevel)}${linkTextOnly}\n\n`;
              }
            }
          }
          return;
        }

        // Рекурсивная обработка дочерних узлов
        element.childNodes.forEach(child => {
          traverse(child, indentLevel);
        });
      }

      function processListItem(liElement, isOrdered, indentLevel, index = 1) {
        const prefix = isOrdered ? `${'  '.repeat(indentLevel)}${index}. ` : `${'  '.repeat(indentLevel)}- `;
        let itemContent = '';

        liElement.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childTagName = child.tagName.toLowerCase();

            if (childTagName === 'ol' || childTagName === 'ul') {
              // Обработка вложенных списков
              itemContent += '\n' + processElementToString(child, indentLevel + 1);
            } else {
              const text = processElementToString(child, indentLevel);
              if (text.trim()) {
                itemContent += text.trim() + ' ';
              }
            }
          } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent.trim();
            if (text) {
              itemContent += text + ' ';
            }
          }
        });

        markdownContent += `${prefix}${itemContent.trim()}\n`;
      }

      function processElementToString(element, indentLevel = 0) {
        let tempMarkdown = '';
        const originalMarkdownContent = markdownContent;
        markdownContent = '';
        processElement(element, indentLevel);
        tempMarkdown = markdownContent;
        markdownContent = originalMarkdownContent;
        return tempMarkdown;
      }

      // Рекурсивная функция для обхода DOM
      function traverse(node, indentLevel = 0) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          if (['p', 'ol', 'ul', 'li', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th'].includes(tagName)) {
            processElement(node, indentLevel);
          } else {
            // Для инлайн-элементов вызываем processChildNodes
            const text = processChildNodes(node);
            if (text) {
              markdownContent += text;
            }
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.replace(/\u00A0/g, ' ');
          if (text) {
            markdownContent += text;
          }
        }
      }

      // Функция для обработки дочерних узлов и формирования Markdown
      function processChildNodes(node, ignoreFormatting = false) {
        let textContent = '';

        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            // Добавляем текст без лишних изменений
            textContent += child.textContent.replace(/\u00A0/g, ' ');
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const nodeName = child.tagName.toLowerCase();
            let childText = '';

            switch (nodeName) {
              case 'strong':
              case 'b':
                {
                  console.log(`Обработка тега <${nodeName}>`);
                  childText = processChildNodes(child, ignoreFormatting);
                  // Изменено: Упрощенная логика добавления жирного форматирования без пробелов
                  if (!ignoreFormatting) {
                    textContent += `**${childText.trim()}**`;
                    console.log(`Добавлено жирное форматирование: **${childText.trim()}**`);
                  } else {
                    textContent += childText;
                  }
                }
                break;
              case 'em':
              case 'i':
                {
                  childText = processChildNodes(child, ignoreFormatting);
                  if (!ignoreFormatting) {
                    textContent += `*${childText}*`;
                  } else {
                    textContent += childText;
                  }
                }
                break;
              case 'code':
                {
                  childText = child.textContent;
                  // Проверяем, нужен ли пробел перед кодом
                  const needsSpaceBefore = textContent && !textContent.endsWith(' ');
                  // Проверяем, нужен ли пробел после кода
                  const nextSibling = child.nextSibling;
                  const needsSpaceAfter = nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.startsWith(' ');

                  if (needsSpaceBefore) {
                    textContent += ' ';
                  }

                  textContent += `\`${childText}\``;

                  if (needsSpaceAfter) {
                    textContent += ' ';
                  }
                }
                break;
              case 'a':
                {
                  const href = child.getAttribute('href');
                  childText = processChildNodes(child).trim();
                  if (href && childText) {
                    textContent += `[${childText}](${href}){target="_blank"}`;
                  } else {
                    textContent += childText;
                  }
                }
                break;
              case 'mark':
                {
                  if (child.classList.contains('mark_cyan') && child.classList.contains('mark')) {
                    const quizText = processChildNodes(child);
                    textContent += `{quiz-task}\n    content: |\n        ${quizText}\n{/quiz-task}\n\n`;
                  } else {
                    const normalMarkText = processChildNodes(child);
                    textContent += `${normalMarkText}`;
                  }
                }
                break;
              case 'img':
                {
                  if (!child.closest('math-inline, math-block')) {
                    const src = child.getAttribute('src');
                    if (src) {
                      const alt = child.getAttribute('alt') || '';
                      textContent += `![${alt}](${src}){target="_blank"}`;
                    }
                  }
                }
                break;
              case 'em-emoji':
                {
                  const emoji = child.getAttribute('native') || '';
                  textContent += `${emoji}`;
                }
                break;
              case 'math-inline':
                {
                  const latex = extractLatex(child);
                  if (latex) {
                    textContent += `{formula}${latex}{/formula}`;
                  }
                }
                break;
              case 'math-block':
                {
                  const latex = extractLatex(child);
                  if (latex) {
                    textContent += `\n{formula}\n${latex}\n{/formula}\n`;
                  }
                }
                break;
              default:
                {
                  childText = processChildNodes(child, ignoreFormatting);
                  textContent += childText;
                }
                break;
            }
          }
        });

        console.log(`processChildNodes возвращает: "${textContent}" для узла <${node.tagName.toLowerCase()}>`);
        return textContent;
      }

      // Функция для извлечения LaTeX из математических формул
      function extractLatex(mathElement) {
        const annotation = mathElement.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
          return annotation.textContent.trim();
        }
        return null;
      }

      // Функция для преобразования таблиц в Markdown
      function convertTableToMarkdown(table, indentLevel) {
        let markdown = '';
        const rows = table.querySelectorAll('tr');
        const markdownRows = [];

        rows.forEach((tr, rowIndex) => {
          const cells = tr.querySelectorAll('th, td');
          const markdownRow = [];

          cells.forEach(cell => {
            const cellText = processChildNodes(cell);
            markdownRow.push(cellText);
          });

          markdownRows.push(markdownRow);
        });

        if (markdownRows.length > 0) {
          // Формируем заголовок таблицы
          const header = markdownRows[0];
          const separator = header.map(() => '---');
          markdown += `${'  '.repeat(indentLevel)}| ${header.join(' | ')} |\n${'  '.repeat(indentLevel)}| ${separator.join(' | ')} |\n`;

          // Формируем остальные строки таблицы
          for (let i = 1; i < markdownRows.length; i++) {
            markdown += `${'  '.repeat(indentLevel)}| ${markdownRows[i].join(' | ')} |\n`;
          }
        }

        return markdown;
      }

      // Обработка выделенного текста
      processSelection(selection);

      // Удаляем лишние пустые строки в начале и конце
      markdownContent = markdownContent.trim();

      console.log('Содержимое выделенного текста в Markdown:', markdownContent);

      if (markdownContent) {
        // Копируем содержимое в буфер обмена
        copyToClipboard(markdownContent);
      } else {
        showNotification('Не удалось найти текст для копирования.', 'error');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      showNotification('Произошла ошибка при выполнении скрипта.', 'error');
    }
  }

  // Функция для копирования текста в буфер обмена
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

    // Сохраняем текущее выделение
    const selection = document.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    tempTextArea.select();

    try {
      document.execCommand('copy');
      showNotification('Текст скопирован в буфер обмена ✅', 'success');
    } catch (err) {
      console.error('Ошибка при копировании текста:', err);
      showNotification('Ошибка при копировании текста.', 'error');
    }

    // Восстанавливаем выделение
    if (range) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.body.removeChild(tempTextArea);
  }

  // Функция для отображения уведомлений в стиле toasts
  function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '30px'; // Положение внизу
    toast.style.right = '30px'; // Положение справа
    toast.style.backgroundColor = type === 'success' ? '#4caf50' : '#f44336'; // Зеленый для успеха, красный для ошибок
    toast.style.color = '#fff';
    toast.style.padding = '16px';
    toast.style.borderRadius = '2px';
    toast.style.fontSize = '17px';
    toast.style.zIndex = '10000';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';

    document.body.appendChild(toast);

    // Плавное появление
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Убираем уведомление через 3 секунды
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }

  // Запуск скрипта
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(copySelectedTextAsMarkdown, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(copySelectedTextAsMarkdown, 1000);
    });
  }
})();
