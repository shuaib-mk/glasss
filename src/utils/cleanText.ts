/**
 * Utility function to strip ALL markdown formatting (asterisks, hashtags, backticks, underscores, links, HRs)
 * returning clean plain text.
 */
export function cleanTextContent(text: string): string {
  if (!text) return '';

  let cleaned = text
    // Remove internal reasoning blocks or <think> tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    // Remove markdown table header/divider lines like |---|---|---| or |:---|:---|
    .replace(/^\|[\s\-:|]+\|$/gm, '')
    .replace(/^[\s\-:|]{3,}$/gm, '');

  // Convert markdown table rows (| cell 1 | cell 2 | cell 3 |) into clean bullet points
  cleaned = cleaned.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0 && !/^[\-:]+$/.test(c));
      if (cells.length === 0) return '';
      if (cells.length === 1) return `- ${cells[0]}`;
      return `- ${cells[0]}: ${cells.slice(1).join(' — ')}`;
    }
    return line;
  }).join('\n');

  return cleaned
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
    // Remove lingering lone asterisks or stray pipe symbols
    .replace(/\*/g, '')
    .replace(/\|/g, '')
    // Clean excessive empty line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
