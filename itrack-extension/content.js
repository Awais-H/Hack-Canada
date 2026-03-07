"use strict";
/**
 * iTrack Firefox extension – content script.
 * Injects a right-side panel on Instagram with Recommended products (top) and All products (bottom).
 * Clicking a product expands to full-picture view (short description + product link).
 * To connect an API later: dispatch CustomEvent 'itrack-products' with detail: { recommended: Product[], all: Product[] }
 * or have background script fetch and send via messaging.
 */
const MOCK_RECOMMENDED = [
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
const MOCK_ALL = [
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
function isInstagram() {
    return window.location.hostname.includes("instagram.com");
}
function getOrCreatePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel)
        return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "itrack-panel";
    document.body.appendChild(panel);
    return panel;
}
function createCloseButton(panel) {
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "itrack-close itrack-close-float";
    closeBtn.setAttribute("aria-label", "Close panel");
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    closeBtn.addEventListener("click", () => {
        panel.classList.add("itrack-panel-hidden");
        const pill = document.getElementById(REOPEN_ID);
        if (pill)
            pill.classList.remove("itrack-reopen-hidden");
    });
    panel.appendChild(closeBtn);
}
const RECOMMENDED_SECTION_ID = "itrack-recommended-section";

function createSection(parent, title, products, containerId, sectionClass, onCloseRecommendations) {
    const section = document.createElement("div");
    section.className = sectionClass ? `itrack-section ${sectionClass}` : "itrack-section";
    const isRecommended = sectionClass === "itrack-section-recommended";
    if (isRecommended) {
        section.id = RECOMMENDED_SECTION_ID;
        section.innerHTML = `<div class="itrack-section-header"><h2 class="itrack-section-title">${escapeHtml(title)}</h2><button type="button" class="itrack-section-close" aria-label="Close recommendations" title="Close recommendations">×</button></div><div id="${containerId}" class="itrack-tiles"></div>`;
        const closeBtn = section.querySelector(".itrack-section-close");
        if (closeBtn) closeBtn.addEventListener("click", () => {
            section.classList.add("itrack-section--closed");
            if (onCloseRecommendations) onCloseRecommendations();
        });
    } else {
        section.innerHTML = `<h2 class="itrack-section-title">${escapeHtml(title)}</h2><div id="${containerId}" class="itrack-tiles"></div>`;
    }
    parent.appendChild(section);
    return section.querySelector(`#${containerId}`);
}
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
function renderTile(container, product, onSelect) {
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
    </div>
  `;
  tile.addEventListener("click", () => {
    onSelect(product);
  });
    container.appendChild(tile);
}
function createExpandedView(panel) {
    const wrap = document.createElement("div");
    wrap.className = "itrack-expanded-wrap itrack-expanded-hidden";
    wrap.innerHTML = `
    <div class="itrack-expanded">
      <button type="button" class="itrack-expanded-back" aria-label="Back to list">← Back</button>
      <div class="itrack-expanded-content"></div>
    </div>
  `;
    const backBtn = wrap.querySelector(".itrack-expanded-back");
    const content = wrap.querySelector(".itrack-expanded-content");
    backBtn.addEventListener("click", () => {
        wrap.classList.add("itrack-expanded-hidden");
    });
    panel.appendChild(wrap);
    return content;
}
function showExpanded(container, product) {
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
    if (wrap)
        wrap.classList.remove("itrack-expanded-hidden");
}
function createReopenPill() {
    if (document.getElementById(REOPEN_ID))
        return;
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
function createPanel() {
    const panel = getOrCreatePanel();
    if (!panel)
        return;
    panel.innerHTML = "";
    panel.classList.remove("itrack-panel-hidden");
    const content = document.createElement("div");
    content.className = "itrack-content";
    panel.appendChild(content);

    const openRecBar = document.createElement("div");
    openRecBar.className = "itrack-open-recommendations itrack-open-hidden";
    openRecBar.innerHTML = `<button type="button" class="itrack-open-recommendations-btn" aria-label="Open recommendations">Open recommendations</button>`;
    const openRecBtn = openRecBar.querySelector(".itrack-open-recommendations-btn");
    content.appendChild(openRecBar);

    const expandedContent = createExpandedView(panel);
    const expandedWrap = panel.querySelector(".itrack-expanded-wrap");
    const showExpandedView = (product) => {
        showExpanded(expandedContent, product);
    };

    const recContainer = createSection(content, "Recommended products", MOCK_RECOMMENDED, "itrack-recommended-tiles", "itrack-section-recommended", () => openRecBar.classList.remove("itrack-open-hidden"));
    if (openRecBtn) {
        openRecBtn.addEventListener("click", () => {
            const recSection = document.getElementById(RECOMMENDED_SECTION_ID);
            if (recSection) recSection.classList.remove("itrack-section--closed");
            openRecBar.classList.add("itrack-open-hidden");
        });
    }
    const allContainer = createSection(content, "All products", MOCK_ALL, "itrack-all-tiles");
    MOCK_RECOMMENDED.forEach((p) => renderTile(recContainer, p, showExpandedView));
    MOCK_ALL.forEach((p) => renderTile(allContainer, p, showExpandedView));
    createCloseButton(panel);
    createReopenPill();
}
function init() {
    if (!isInstagram())
        return;
    if (document.getElementById(PANEL_ID))
        return;
    createPanel();
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
}
else {
    init();
}
window.addEventListener("itrack-products", ((e) => {
    const { recommended, all } = e.detail || { recommended: [], all: [] };
    const recContainer = document.getElementById("itrack-recommended-tiles");
    const allContainer = document.getElementById("itrack-all-tiles");
    const expandedContent = document.querySelector(".itrack-expanded-content");
    if (!recContainer || !allContainer || !expandedContent)
        return;
    const showExpandedView = (product) => showExpanded(expandedContent, product);
    recContainer.innerHTML = "";
    allContainer.innerHTML = "";
    recommended.forEach((p) => renderTile(recContainer, p, showExpandedView));
    all.forEach((p) => renderTile(allContainer, p, showExpandedView));
}));
