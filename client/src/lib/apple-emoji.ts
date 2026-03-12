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
    try {
      const text = document.createTextNode(emoji);
      img.replaceWith(text);
    } catch {}
  };
  return img;
}

function processTextNode(node: Text) {
  try {
    if (!node.parentNode || !node.isConnected) return;
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

    if (fragment.childNodes.length > 0 && node.parentNode && node.isConnected) {
      node.replaceWith(fragment);
    }
  } catch {}
}

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT" || tag === "CODE" || tag === "PRE" || tag === "SELECT" || tag === "OPTION") {
    return true;
  }
  if (parent.classList.contains("apple-emoji") || parent.tagName === "IMG") {
    return true;
  }
  if (parent.getAttribute("contenteditable") === "true") return true;
  return false;
}

function walkAndReplace(root: Node) {
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipNode(node) ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }
    textNodes.forEach(processTextNode);
  } catch {}
}

let observer: MutationObserver | null = null;
let rafId: number | null = null;
const pendingNodes = new Set<Node>();

export function initAppleEmoji() {
  if (observer) return;

  setTimeout(() => walkAndReplace(document.body), 100);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            pendingNodes.add(node);
          }
        });
      }
    }

    if (pendingNodes.size === 0) return;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();
      rafId = null;

      for (const node of nodes) {
        if (!node.isConnected) continue;
        try {
          if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node as Text);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walkAndReplace(node);
          }
        } catch {}
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
