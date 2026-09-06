/**
 * Utility function to strip ALL markdown formatting (asterisks, hashtags, backticks, underscores, links, HRs)
 * returning clean plain text.
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
