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
        name: "Pegasus Runner",
        shortDescription: "Lightweight road-running shoe",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=280&h=280&fit=crop",
        price: "$120",
        url: "https://www.nike.com/example",
        kind: "recommended",
    },
    {
        id: "rec-2",
        name: "Studio Headphones",
        shortDescription: "Noise-cancelling over-ear",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=280&h=280&fit=crop",
        price: "$349",
        url: "https://example.com/headphones",
        kind: "recommended",
    },
    {
        id: "rec-3",
        name: "Everyday Tote",
        shortDescription: "Soft leather carry-all",
        imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=280&h=280&fit=crop",
        price: "$245",
        url: "https://example.com/tote",
        kind: "recommended",
    },
];
const MOCK_ALL = [
    {
        id: "all-1",
        name: "Classic Tee",
        shortDescription: "Organic cotton, relaxed fit",
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=280&h=280&fit=crop",
        price: "$25",
        url: "https://example.com/tshirt",
        kind: "all",
    },
    {
        id: "all-2",
        name: "Daypack",
        shortDescription: "Minimal everyday backpack",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=280&h=280&fit=crop",
        price: "$89",
        url: "https://example.com/backpack",
        kind: "all",
    },
    {
        id: "all-3",
        name: "Smart Water Bottle",
        shortDescription: "Tracks intake, glows on schedule",
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=280&h=280&fit=crop",
        price: "$59",
        url: "https://example.com/bottle",
        kind: "all",
    },
];
const PANEL_ID = "itrack-panel";
const REOPEN_ID = "itrack-reopen-pill";
const THEME_STORAGE_KEY = "itrack-theme";
function getInitialTheme() {
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "dark" || stored === "light") {
            return stored;
        }
    }
    catch {
        // ignore
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
    }
    return "dark";
}
function applyTheme(panel, theme) {
    panel.setAttribute("data-theme", theme);
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    catch {
        // ignore
    }
}
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
    const initialTheme = getInitialTheme();
    applyTheme(panel, initialTheme);
    document.body.appendChild(panel);
    return panel;
}
function createHeader(panel) {
    var _a;
    const header = document.createElement("div");
    header.className = "itrack-header";
    header.innerHTML = `
    <div class="itrack-header-left">
      <span class="itrack-title">iTrack</span>
    </div>
    <div class="itrack-header-right">
      <div class="itrack-theme-switch" role="switch" aria-label="Dark or light mode" aria-checked="true">
        <span class="itrack-theme-switch-track">
          <span class="itrack-theme-switch-thumb"></span>
          <button type="button" class="itrack-theme-option itrack-theme-dark" aria-label="Dark mode" title="Dark mode">
            <svg class="itrack-icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button type="button" class="itrack-theme-option itrack-theme-light" aria-label="Light mode" title="Light mode">
            <svg class="itrack-icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </span>
      </div>
      <button type="button" class="itrack-close" aria-label="Close panel">
            <svg class="itrack-icon-close" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
    </div>
  `;
    const themeSwitch = header.querySelector(".itrack-theme-switch");
    const themeDark = header.querySelector(".itrack-theme-dark");
    const themeLight = header.querySelector(".itrack-theme-light");
    if (themeSwitch && themeDark && themeLight) {
        const updateSwitchState = (theme) => {
            themeSwitch.setAttribute("data-theme", theme);
            themeSwitch.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
            themeDark.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
            themeLight.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
        };
        const currentTheme = (_a = panel.getAttribute("data-theme")) !== null && _a !== void 0 ? _a : getInitialTheme();
        updateSwitchState(currentTheme);
        themeDark.addEventListener("click", () => {
            applyTheme(panel, "dark");
            updateSwitchState("dark");
        });
        themeLight.addEventListener("click", () => {
            applyTheme(panel, "light");
            updateSwitchState("light");
        });
    }
    const closeBtn = header.querySelector(".itrack-close");
    closeBtn.addEventListener("click", () => {
        panel.classList.add("itrack-panel-hidden");
        const pill = document.getElementById(REOPEN_ID);
        if (pill)
            pill.classList.remove("itrack-reopen-hidden");
    });
    panel.appendChild(header);
}
function createSection(parent, title, products, containerId) {
    const section = document.createElement("div");
    section.className = "itrack-section";
    section.innerHTML = `<h2 class="itrack-section-title">${escapeHtml(title)}</h2><div id="${containerId}" class="itrack-tiles"></div>`;
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
      <a class="itrack-tile-link" href="${escapeHtml(product.url)}" target="_blank" rel="noopener noreferrer">View</a>
    </div>
  `;
    tile.addEventListener("click", (e) => {
        const link = e.target.closest("a.itrack-tile-link");
        if (link)
            return;
        e.preventDefault();
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
    createHeader(panel);
    const content = document.createElement("div");
    content.className = "itrack-content";
    panel.appendChild(content);
    const expandedContent = createExpandedView(panel);
    const expandedWrap = panel.querySelector(".itrack-expanded-wrap");
    const showExpandedView = (product) => {
        showExpanded(expandedContent, product);
    };
    const recContainer = createSection(content, "Recommended products", MOCK_RECOMMENDED, "itrack-recommended-tiles");
    const allContainer = createSection(content, "All products", MOCK_ALL, "itrack-all-tiles");
    MOCK_RECOMMENDED.forEach((p) => renderTile(recContainer, p, showExpandedView));
    MOCK_ALL.forEach((p) => renderTile(allContainer, p, showExpandedView));
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
