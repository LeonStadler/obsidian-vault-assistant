import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const markdown = new MarkdownIt({ html: false, linkify: true });
const sanitizerOptions = {
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
};

export function renderSafeMarkdown(source) {
  const rendered = markdown.render(source);
  return DOMPurify.sanitize(rendered, sanitizerOptions);
}
