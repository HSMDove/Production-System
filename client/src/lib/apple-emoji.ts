const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

function emojiToCodepoints(emoji: string): string {
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xfe0f) {
      codepoints.push(cp.toString(16));
    }
  }
  return codepoints.join("-");
}

const CDN_BASE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64";

function createEmojiImg(emoji: string): HTMLImageElement {
  const img = document.createElement("img");
  const codepoints = emojiToCodepoints(emoji);
  img.src = `${CDN_BASE}/${codepoints}.png`;
  img.alt = emoji;
  img.className = "apple-emoji";
  img.draggable = false;
  img.loading = "lazy";
  img.onerror = () => {
    const text = document.createTextNode(emoji);
    img.replaceWith(text);
  };
  return img;
}

function processTextNode(node: Text) {
  const text = node.textContent;
  if (!text || !emojiRegex.test(text)) return;

  emojiRegex.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = emojiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    fragment.appendChild(createEmojiImg(match[0]));
    lastIndex = emojiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  if (fragment.childNodes.length > 0) {
    node.replaceWith(fragment);
  }
}

function walkAndReplace(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_SKIP;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT" || tag === "CODE" || tag === "PRE") {
        return NodeFilter.FILTER_SKIP;
      }
      if (parent.classList.contains("apple-emoji") || parent.tagName === "IMG") {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }
  textNodes.forEach(processTextNode);
}

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingNodes = new Set<Node>();

export function initAppleEmoji() {
  if (observer) return;

  walkAndReplace(document.body);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            pendingNodes.add(node);
          }
        });
      } else if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        pendingNodes.add(mutation.target);
      }
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pendingNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          processTextNode(node as Text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walkAndReplace(node);
        }
      });
      pendingNodes.clear();
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
