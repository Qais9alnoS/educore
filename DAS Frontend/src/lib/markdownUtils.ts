/**
 * Markdown conversion utilities
 * Handles conversion between HTML and Markdown formats
 */

/**
 * Convert HTML to Markdown
 */
export const htmlToMarkdown = (html: string): string => {
  let markdown = html;

  // Remove p tags and replace with newlines
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, content) => {
    return content.trim() + '\n\n';
  });

  // Handle headers
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (match, content) => {
    return '# ' + stripHtml(content).trim() + '\n\n';
  });
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (match, content) => {
    return '## ' + stripHtml(content).trim() + '\n\n';
  });
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (match, content) => {
    return '### ' + stripHtml(content).trim() + '\n\n';
  });

  // Handle bold
  markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (match, content) => {
    return '**' + stripHtml(content).trim() + '**';
  });
  markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (match, content) => {
    return '**' + stripHtml(content).trim() + '**';
  });

  // Handle italic
  markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (match, content) => {
    return '*' + stripHtml(content).trim() + '*';
  });
  markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (match, content) => {
    return '*' + stripHtml(content).trim() + '*';
  });

  // Handle strikethrough
  markdown = markdown.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, (match, content) => {
    return '~~' + stripHtml(content).trim() + '~~';
  });
  markdown = markdown.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, (match, content) => {
    return '~~' + stripHtml(content).trim() + '~~';
  });

  // Handle blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    const lines = stripHtml(content).trim().split('\n');
    return lines.map(line => '> ' + line).join('\n') + '\n\n';
  });

  // Handle code blocks
  markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, content) => {
    return '```\n' + stripHtml(content).trim() + '\n```\n\n';
  });
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, content) => {
    return '`' + stripHtml(content).trim() + '`';
  });

  // Handle horizontal rules
  markdown = markdown.replace(/<hr[^>]*>/gi, '---\n\n');

  // Handle unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return items.map(item => {
      const itemContent = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return '- ' + stripHtml(itemContent);
    }).join('\n') + '\n\n';
  });

  // Handle ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return items.map((item, index) => {
      const itemContent = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return (index + 1) + '. ' + stripHtml(itemContent);
    }).join('\n') + '\n\n';
  });

  // Handle tables
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, content) => {
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    const markdownRows = rows.map((row, rowIndex) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const cellContents = cells.map(cell => stripHtml(cell).trim());
      return '| ' + cellContents.join(' | ') + ' |';
    });

    if (markdownRows.length > 0) {
      // Add header separator after first row
      const firstRow = markdownRows[0];
      const cellCount = (firstRow.match(/\|/g) || []).length - 1;
      const separator = '|' + Array(cellCount).fill('---|').join('');
      markdownRows.splice(1, 0, separator);
    }

    return markdownRows.join('\n') + '\n\n';
  });

  // Handle line breaks
  markdown = markdown.replace(/<br[^>]*>/gi, '\n');

  // Clean up multiple newlines
  markdown = markdown.replace(/\n\n\n+/g, '\n\n');

  return markdown.trim();
};

/**
 * Convert Markdown to HTML
 */
export const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Escape HTML special characters first
  html = escapeHtml(html);

  // Tables (must be before bold/italic processing)
  html = html.replace(/\|[\s\S]*?\|/gm, (match) => {
    const lines = match.trim().split('\n');
    let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;"><tbody>';

    lines.forEach((line, idx) => {
      // Skip separator rows
      if (line.includes('---')) return;

      const cells = line.split('|').filter(c => c.trim());
      const isHeader = idx === 0;
      const tag = isHeader ? 'th' : 'td';
      const bgColor = isHeader ? ' style="background-color: var(--table-header-bg); color: var(--table-header-text); border: 1px solid var(--border); padding: 8px; font-weight: bold;"' : ' style="border: 1px solid var(--border); padding: 8px;"';

      tableHtml += '<tr>';
      cells.forEach(cell => {
        tableHtml += `<${tag}${bgColor}>${cell.trim()}</${tag}>`;
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // Headers (must be before bold/italic)
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background-color: var(--code-bg); border: 1px solid var(--border); border-radius: 4px; padding: 12px; overflow-x: auto; color: var(--code-text);"><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: var(--code-inline-bg); color: var(--code-inline-text); padding: 2px 6px; border-radius: 3px;">$1</code>');

  // Bold (before italic)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Lists
  html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li>.*?<\/li>)/s, (match) => {
    const isOrdered = match.match(/^\d+\./);
    const tag = isOrdered ? 'ol' : 'ul';
    return `<${tag}>${match}</${tag}>`;
  });

  // Paragraphs (preserve existing formatting)
  const lines = html.split('\n\n');
  html = lines
    .map(line => {
      line = line.trim();
      // Skip if already wrapped in tags
      if (
        line.match(/^<[hpuold]/) ||
        line.match(/<\/[hpuold]>$/) ||
        line.match(/^<table/) ||
        line.match(/^<blockquote/) ||
        line.match(/^<pre/)
      ) {
        return line;
      }
      return line ? `<p>${line}</p>` : '';
    })
    .join('');

  return html;
};

/**
 * Strip HTML tags from text
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Escape HTML special characters
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Unescape HTML special characters
 */
export const unescapeHtml = (html: string): string => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};
