import MarkdownIt from 'markdown-it';
import DOMPurify from 'isomorphic-dompurify';

// Configure markdown-it with strict security & proper typography settings
const md = new MarkdownIt({
  html: false, // strictly disable raw HTML tags to prevent XSS
  linkify: true, // auto-convert URL-like text to links
  breaks: true, // convert \n into <br> for conversational readability
  typographer: false,
});

// Enforce safe external link attributes (target="_blank" and rel="noopener noreferrer")
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/**
 * Parses markdown into clean, sanitized HTML safe for assistant message display.
 */
export function renderAssistantMarkdown(content: string): string {
  if (!content) return '';

  const rawHtml = md.render(content);

  // Sanitize with DOMPurify while preserving the safe link attributes
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
  });
}

