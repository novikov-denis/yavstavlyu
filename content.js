(function() {
  function copyMarkdownContent() {
    try {
      console.log('Ищем элемент с селектором .ProseMirror');
      const noteElement = document.querySelector('.ProseMirror');

      console.log('Найденный элемент:', noteElement);

      if (noteElement) {
        let markdownContent = '';

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
            const text = processChildNodes(element, true).trim(); // ignoreFormatting = true
            markdownContent += `\n${'  '.repeat(indentLevel)}${prefix}${text}\n\n`;
            return;
          }

          // Обработка параграфов
          if (tagName === 'p') {
            if (hasBackgroundColorClass(element)) {
              const text = processChildNodes(element).trim();
              markdownContent += `{quiz-task}\n    background: |\n        #f5f6f7\n    content: |\n        ${text}\n{/quiz-task}\n\n`;
              return;
            }

            // Проверяем, содержит ли <p> несколько <mark class="mark_cyan mark">
            const marks = element.querySelectorAll('mark.mark_cyan.mark');
            if (marks.length > 0) {
              let combinedContent = '';
              marks.forEach(mark => {
                combinedContent += processChildNodes(mark).trim() + ' ';
              });
              combinedContent = combinedContent.trim();
              markdownContent += `{quiz-task}\n    background: |\n        #f5f6f7\n    content: |\n        ${combinedContent}\n{/quiz-task}\n\n`;
              return;
            }

            const text = processChildNodes(element).trim();
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
              markdownContent += `\n${'  '.repeat(indentLevel)}{formula}${latex}{/formula}\n\n`;
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
              if (src) {  // Проверяем наличие src
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

          // Рекурсивная обработка остальных элементов
          traverse(element, indentLevel);
        }

        function processListItem(liElement, isOrdered, indentLevel, index = 1) {
          const prefix = isOrdered ? `${'  '.repeat(indentLevel)}${index}. ` : `${'  '.repeat(indentLevel)}- `;
          let contentLines = [];
          let subContent = '';

          liElement.childNodes.forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const childTagName = child.tagName.toLowerCase();
              if (childTagName === 'ol' || childTagName === 'ul') {
                subContent += processElementToString(child, indentLevel + 1);
              } else if (childTagName === 'p') {
                const paragraphText = processChildNodes(child).trim();
                if (paragraphText) {
                  contentLines.push(paragraphText);
                }
              } else {
                const text = processChildNodes(child).trim();
                if (text) {
                  contentLines.push(text);
                }
              }
            } else if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent.trim();
              if (text) {
                contentLines.push(text);
              }
            }
          });

          // Добавляем первую строку после префикса
          if (contentLines.length > 0) {
            const firstLine = contentLines.shift();
            markdownContent += `${prefix}${firstLine}\n`;
          } else {
            markdownContent += `${prefix}\n`;
          }

          // Остальные строки добавляем с отступами
          contentLines.forEach(line => {
            markdownContent += `${'  '.repeat(indentLevel + 1)}${line}\n\n`;
          });

          if (subContent) {
            markdownContent += `${subContent}`;
          }
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
          node.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              processElement(child, indentLevel);
            } else if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent.trim();
              if (text) {
                markdownContent += `${'  '.repeat(indentLevel)}${text}\n`;
              }
            }
          });
        }

        // Функция для обработки дочерних узлов и формирования Markdown
        function processChildNodes(node, ignoreFormatting = false) {
          let textContent = '';
          node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              textContent += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const nodeName = child.tagName.toLowerCase();
              switch (nodeName) {
                case 'strong':
                  {
                    const boldText = processChildNodes(child, ignoreFormatting).trim();
                    if (!ignoreFormatting) {
                      textContent += `**${boldText}**`;
                    } else {
                      textContent += boldText;
                    }
                  }
                  break;
                case 'em':
                  {
                    const italicText = processChildNodes(child, ignoreFormatting).trim();
                    if (!ignoreFormatting) {
                      textContent += `*${italicText}*`;
                    } else {
                      textContent += italicText;
                    }
                  }
                  break;
                case 'code':
                  {
                    const codeText = child.textContent.trim();
                    textContent += `\`${codeText}\``;
                  }
                  break;
                case 'mark':
                  {
                    if (child.classList.contains('mark_cyan') && child.classList.contains('mark')) {
                      const quizText = processChildNodes(child).trim();
                      textContent += `{quiz-task}\n    content: |\n        ${quizText}\n{/quiz-task}\n\n`;
                    } else {
                      const normalMarkText = processChildNodes(child).trim();
                      textContent += `${normalMarkText}`;
                    }
                  }
                  break;
                case 'img':
                  {
                    if (!child.closest('math-inline, math-block')) {
                      const src = child.getAttribute('src');
                      if (src) { // Проверяем наличие src
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
                case 'a':
                  {
                    if (child.querySelector('math-inline, math-block, img')) {
                      textContent += processChildNodes(child);
                    } else {
                      const href = child.getAttribute('href');
                      const linkText = processChildNodes(child).trim();
                      if (href && linkText) {
                        const linkMarkdown = `[${linkText}](${href}){target="_blank"}`;
                        textContent += `${linkMarkdown}`;
                      } else {
                        const linkTextOnly = processChildNodes(child).trim();
                        if (linkTextOnly) {
                          textContent += `${linkTextOnly}`;
                        }
                      }
                    }
                  }
                  break;
                default:
                  {
                    textContent += processChildNodes(child, ignoreFormatting);
                  }
                  break;
              }
            }
          });
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
              const cellText = processChildNodes(cell).trim();
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

        // Запускаем обработку элемента заметки
        traverse(noteElement);

        // Удаляем лишние пустые строки в начале и конце
        markdownContent = markdownContent.trim();

        console.log('Содержимое заметки:', markdownContent);

        if (markdownContent) {
          // Копируем содержимое в буфер обмена
          copyToClipboard(markdownContent);
        } else {
          showNotification('Markdown содержимое не найдено.', 'error');
        }
      } else {
        showNotification('Фигня, давай по новой ♻️', 'error');
      }
    } catch (error) {
      console.error('Ошибка в content.js:', error);
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

    tempTextArea.select();

    try {
      document.execCommand('copy');
      showNotification('Текст урока скопирован в буфер обмена ✅', 'success');
    } catch (err) {
      console.error('Ошибка при копировании текста в буфер обмена:', err);
      showNotification('Ошибка при копировании в буфер обмена.', 'error');
    }

    document.body.removeChild(tempTextArea);
  }

  // Функция для отображения уведомлений
  function showNotification(message, type = 'success') {
    let notificationContainer = document.getElementById('markdown-copy-notification');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'markdown-copy-notification';
      notificationContainer.style.position = 'fixed';
      notificationContainer.style.top = '20px';
      notificationContainer.style.right = '20px';
      notificationContainer.style.padding = '15px 25px';
      notificationContainer.style.borderRadius = '5px';
      notificationContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      notificationContainer.style.zIndex = '10000';
      notificationContainer.style.opacity = '0';
      notificationContainer.style.transition = 'opacity 0.5s ease';
      notificationContainer.style.color = '#fff';
      notificationContainer.style.display = 'none';
      document.body.appendChild(notificationContainer);
    }

    if (type === 'success') {
      notificationContainer.style.backgroundColor = '#4caf50';
    } else if (type === 'error') {
      notificationContainer.style.backgroundColor = '#f44336';
    } else {
      notificationContainer.style.backgroundColor = '#2196F3';
    }

    notificationContainer.textContent = message;

    notificationContainer.style.display = 'block';
    requestAnimationFrame(() => {
      notificationContainer.style.opacity = '1';
    });

    setTimeout(() => {
      notificationContainer.style.opacity = '0';
      setTimeout(() => {
        if (notificationContainer.style.opacity === '0') {
          notificationContainer.style.display = 'none';
          notificationContainer.textContent = '';
        }
      }, 500);
    }, 3000);
  }

  // Запуск функции после загрузки страницы
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(copyMarkdownContent, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(copyMarkdownContent, 1000);
    });
  }
})();
