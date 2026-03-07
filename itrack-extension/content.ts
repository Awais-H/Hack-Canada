/**
 * iTrack Firefox extension – content script.
 * Injects a right-side panel on Instagram with Recommended products (top) and All products (bottom).
 * Clicking a product expands to full-picture view (short description + product link).
 * To connect an API later: dispatch CustomEvent 'itrack-products' with detail: { recommended: Product[], all: Product[] }
 * or have background script fetch and send via messaging.
 */

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  imageUrl: string;
  price?: string;
  url: string;
  kind: "recommended" | "all";
}

const MOCK_RECOMMENDED: Product[] = [
  {
    id: "rec-1",
    name: "Nike Pegasus",
    shortDescription: "running shoes",
    imageUrl: "https://placehold.co/120x120/1a1a1a/eee?text=Shoe",
    price: "$120",
    url: "https://www.nike.com/example",
    kind: "recommended",
  },
  {
    id: "rec-2",
    name: "Wireless Earbuds",
    shortDescription: "wireless earbuds",
    imageUrl: "https://placehold.co/120x120/1a1a1a/eee?text=Earbuds",
    price: "$49",
    url: "https://example.com/earbuds",
    kind: "recommended",
  },
];

const MOCK_ALL: Product[] = [
  {
    id: "all-1",
    name: "T-shirt",
    shortDescription: "cotton t-shirt",
    imageUrl: "https://placehold.co/120x120/1a1a1a/eee?text=T-shirt",
    price: "$25",
    url: "https://example.com/tshirt",
    kind: "all",
  },
  {
    id: "all-2",
    name: "Backpack",
    shortDescription: "daypack backpack",
    imageUrl: "https://placehold.co/120x120/1a1a1a/eee?text=Bag",
    price: "$65",
    url: "https://example.com/backpack",
    kind: "all",
  },
];

const PANEL_ID = "itrack-panel";
const REOPEN_ID = "itrack-reopen-pill";

function isInstagram(): boolean {
  return window.location.hostname.includes("instagram.com");
}

function getOrCreatePanel(): HTMLElement | null {
  let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "itrack-panel";
  document.body.appendChild(panel);
  return panel;
}

function createHeader(panel: HTMLElement): void {
  const header = document.createElement("div");
  header.className = "itrack-header";
  header.innerHTML = `
    <span class="itrack-title">iTrack</span>
    <button type="button" class="itrack-close" aria-label="Close panel">×</button>
  `;
  const closeBtn = header.querySelector(".itrack-close") as HTMLButtonElement;
  closeBtn.addEventListener("click", () => {
    panel.classList.add("itrack-panel-hidden");
    const pill = document.getElementById(REOPEN_ID);
    if (pill) pill.classList.remove("itrack-reopen-hidden");
  });
  panel.appendChild(header);
}

function createSection(
  parent: HTMLElement,
  title: string,
  products: Product[],
  containerId: string
): HTMLElement {
  const section = document.createElement("div");
  section.className = "itrack-section";
  section.innerHTML = `<h2 class="itrack-section-title">${escapeHtml(title)}</h2><div id="${containerId}" class="itrack-tiles"></div>`;
  parent.appendChild(section);
  return section.querySelector(`#${containerId}`) as HTMLElement;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderTile(container: HTMLElement, product: Product, onSelect: (p: Product) => void): void {
  const tile = document.createElement("div");
  tile.className = "itrack-tile";
  tile.setAttribute("data-product-id", product.id);
  const priceHtml = product.price ? ` <span class="itrack-tile-price">${escapeHtml(product.price)}</span>` : "";
  tile.innerHTML = `
    <div class="itrack-tile-media">
      <img src="${escapeHtml(product.imageUrl)}" alt="" width="56" height="56" loading="lazy" />
    </div>
    <div class="itrack-tile-body">
      <span class="itrack-tile-name">${escapeHtml(product.name)}</span>${priceHtml}
      <a class="itrack-tile-link" href="${escapeHtml(product.url)}" target="_blank" rel="noopener noreferrer">View</a>
    </div>
  `;
  tile.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest("a.itrack-tile-link");
    if (link) return;
    e.preventDefault();
    onSelect(product);
  });
  container.appendChild(tile);
}

function createExpandedView(panel: HTMLElement): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "itrack-expanded-wrap itrack-expanded-hidden";
  wrap.innerHTML = `
    <div class="itrack-expanded">
      <button type="button" class="itrack-expanded-back" aria-label="Back to list">← Back</button>
      <div class="itrack-expanded-content"></div>
    </div>
  `;
  const backBtn = wrap.querySelector(".itrack-expanded-back") as HTMLButtonElement;
  const content = wrap.querySelector(".itrack-expanded-content") as HTMLElement;
  backBtn.addEventListener("click", () => {
    wrap.classList.add("itrack-expanded-hidden");
  });
  panel.appendChild(wrap);
  return content;
}

function showExpanded(container: HTMLElement, product: Product): void {
  const priceHtml = product.price ? `<p class="itrack-expanded-price">${escapeHtml(product.price)}</p>` : "";
  container.innerHTML = `
    <div class="itrack-expanded-image">
      <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="280" height="280" />
    </div>
    <h3 class="itrack-expanded-name">${escapeHtml(product.name)}</h3>
    <p class="itrack-expanded-desc">${escapeHtml(product.shortDescription)}</p>
    ${priceHtml}
    <a class="itrack-expanded-link" href="${escapeHtml(product.url)}" target="_blank" rel="noopener noreferrer">Open product</a>
  `;
  const wrap = container.closest(".itrack-expanded-wrap");
  if (wrap) wrap.classList.remove("itrack-expanded-hidden");
}

function createReopenPill(): void {
  if (document.getElementById(REOPEN_ID)) return;
  const pill = document.createElement("button");
  pill.id = REOPEN_ID;
  pill.type = "button";
  pill.className = "itrack-reopen-pill";
  pill.setAttribute("aria-label", "Open iTrack panel");
  pill.textContent = "iTrack";
  pill.addEventListener("click", () => {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.remove("itrack-panel-hidden");
      pill.classList.add("itrack-reopen-hidden");
    }
  });
  document.body.appendChild(pill);
}

function createPanel(): void {
  const panel = getOrCreatePanel();
  if (!panel) return;

  panel.innerHTML = "";
  panel.classList.remove("itrack-panel-hidden");

  createHeader(panel);

  const content = document.createElement("div");
  content.className = "itrack-content";
  panel.appendChild(content);

  const expandedContent = createExpandedView(panel);
  const expandedWrap = panel.querySelector(".itrack-expanded-wrap") as HTMLElement;
  const showExpandedView = (product: Product) => {
    showExpanded(expandedContent, product);
  };

  const recContainer = createSection(
    content,
    "Recommended products",
    MOCK_RECOMMENDED,
    "itrack-recommended-tiles"
  );
  const allContainer = createSection(
    content,
    "All products",
    MOCK_ALL,
    "itrack-all-tiles"
  );

  MOCK_RECOMMENDED.forEach((p) => renderTile(recContainer, p, showExpandedView));
  MOCK_ALL.forEach((p) => renderTile(allContainer, p, showExpandedView));

  createReopenPill();
}

function init(): void {
  if (!isInstagram()) return;
  if (document.getElementById(PANEL_ID)) return;
  createPanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("itrack-products", ((e: CustomEvent<{ recommended: Product[]; all: Product[] }>) => {
  const { recommended, all } = e.detail || { recommended: [], all: [] };
  const recContainer = document.getElementById("itrack-recommended-tiles");
  const allContainer = document.getElementById("itrack-all-tiles");
  const expandedContent = document.querySelector(".itrack-expanded-content") as HTMLElement | null;
  if (!recContainer || !allContainer || !expandedContent) return;
  const showExpandedView = (product: Product) => showExpanded(expandedContent, product);
  recContainer.innerHTML = "";
  allContainer.innerHTML = "";
  recommended.forEach((p) => renderTile(recContainer, p, showExpandedView));
  all.forEach((p) => renderTile(allContainer, p, showExpandedView));
}) as EventListener);
