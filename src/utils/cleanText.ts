/**
 * Utility function to strip markdown formatting (asterisks, hashtags, backticks, underscores, links, HRs)
 * returning clean text while preserving markdown tables for interactive column/table UI rendering.
 */
export function cleanTextContent(text: string): string {
  if (!text) return '';

  return text
    // Remove internal reasoning blocks or <think> tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    // Strip bold & italic asterisks
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')   // Bold italic ***text***
    .replace(/\*\*(.*?)\*\*/g, '$1')       // Bold **text**
    .replace(/\*(.*?)\*/g, '$1')           // Italic *text*
    // Strip bold & italic underscores
    .replace(/___(.*?)___/g, '$1')         // Bold italic ___text___
    .replace(/__(.*?)__/g, '$1')           // Bold __text__
    .replace(/_(.*?)_/g, '$1')             // Italic _text_
    // Strip code blocks & backticks
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    })
    .replace(/`(.*?)`/g, '$1')             // Backticks `text`
    // Strip markdown images & links
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')   // Images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')    // Links
    // Strip headers (# Header -> Header)
    .replace(/^#+\s+/gm, '')
    // Strip horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Convert asterisk bullet points to plain dashes (* item -> - item)
    .replace(/^\s*\*\s+/gm, '- ')
    // Remove lingering lone asterisks
    .replace(/\*/g, '')
    // Clean excessive empty line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface TextBlock {
  type: 'paragraph';
  content: string;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export type ContentBlock = TextBlock | TableBlock;

/**
 * Parses cleaned text content into structural blocks (paragraphs vs interactive HTML tables).
 */
export function parseContentBlocks(text: string): ContentBlock[] {
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: ContentBlock[] = [];
  let currentParagraphLines: string[] = [];
  let currentTableLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const paragraphText = currentParagraphLines.join('\n').trim();
      if (paragraphText) {
        blocks.push({ type: 'paragraph', content: paragraphText });
      }
      currentParagraphLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      const parsedRows: string[][] = [];
      for (const line of currentTableLines) {
        const trimmed = line.trim();
        // Ignore table divider lines like |---|---| or |:---|:---|
        if (/^\|[\s\-:|]+\|$/.test(trimmed) || /^[\s\-:|]{3,}$/.test(trimmed)) {
          continue;
        }
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          const cells = trimmed
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
          parsedRows.push(cells);
        }
      }

      if (parsedRows.length > 0) {
        const headers = parsedRows[0];
        const rows = parsedRows.slice(1);
        blocks.push({ type: 'table', headers, rows });
      } else {
        currentParagraphLines.push(...currentTableLines);
        flushParagraph();
      }
      currentTableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isTableRow = (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) ||
                       /^\|[\s\-:|]+\|$/.test(trimmed);

    if (isTableRow) {
      flushParagraph();
      currentTableLines.push(line);
    } else {
      if (currentTableLines.length > 0) {
        flushTable();
      }
      currentParagraphLines.push(line);
    }
  }

  flushParagraph();
  flushTable();

  return blocks;
}
