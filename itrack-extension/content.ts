/**
 * iTrack Firefox extension – content script.
 * Injects a right-side panel on Instagram with Recommended products (top) and All products (bottom).
 * Clicking a product tile redirects to its link immediately in a new tab.
 * Removes Instagram Reels nav buttons, Messages toolbar, and floating buttons dynamically.
 */

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  imageUrl: string;
  price?: string;
  url: string; // product link
  kind: "recommended" | "all";
}

const MOCK_RECOMMENDED: Product[] = [
  { id: "rec-1", name: "Pegasus Runner", shortDescription: "Lightweight road-running shoe", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=280&h=280&fit=crop", price: "$120", url: "https://example.com/pegasus-runner", kind: "recommended" },
  { id: "rec-2", name: "Studio Headphones", shortDescription: "Noise-cancelling over-ear", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=280&h=280&fit=crop", price: "$349", url: "https://example.com/studio-headphones", kind: "recommended" },
  { id: "rec-3", name: "Everyday Tote", shortDescription: "Soft leather carry-all", imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=280&h=280&fit=crop", price: "$245", url: "https://example.com/everyday-tote", kind: "recommended" },
];

const MOCK_ALL: Product[] = [
  { id: "all-1", name: "Classic Tee", shortDescription: "Organic cotton, relaxed fit", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=280&h=280&fit=crop", price: "$25", url: "https://example.com/classic-tee", kind: "all" },
  { id: "all-2", name: "Daypack", shortDescription: "Minimal everyday backpack", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=280&h=280&fit=crop", price: "$89", url: "https://example.com/daypack", kind: "all" },
  { id: "all-3", name: "Smart Water Bottle", shortDescription: "Tracks intake, glows on schedule", imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=280&h=280&fit=crop", price: "$59", url: "https://example.com/smart-bottle", kind: "all" },
];

const PANEL_ID = "itrack-panel";
const REOPEN_ID = "itrack-reopen-pill";

function isInstagram(): boolean {
  return window.location.hostname.includes("instagram.com");
}

function removeInstagramUI(): void {
  document.querySelectorAll('div[aria-label*="Messages"]').forEach(el => el.remove());
  document.querySelectorAll('div[role="button"] > div[data-visualcompletion="ignore"]').forEach(el => el.parentElement?.remove());
  const reelsNav = document.querySelector('div[aria-label="Reels navigation controls"]');
  if (reelsNav) reelsNav.remove();

  const observer = new MutationObserver(() => {
    document.querySelectorAll('div[aria-label*="Messages"]').forEach(el => el.remove());
    document.querySelectorAll('div[role="button"] > div[data-visualcompletion="ignore"]').forEach(el => el.parentElement?.remove());
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

function getOrCreatePanel(): HTMLElement {
  let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "itrack-panel";
    document.body.appendChild(panel);
  }
  panel.innerHTML = "";
  return panel;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function attachImageFallback(img: HTMLImageElement): void {
  img.addEventListener("error", () => {
    img.src = "https://placehold.co/280x280/111827/F9FAFB?text=Product";
  }, { once: true });
}

// Clicking tile now opens the product URL in a new tab
function renderTile(container: HTMLElement, product: Product): void {
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
  const img = tile.querySelector("img") as HTMLImageElement | null;
  if (img) attachImageFallback(img);

  // Open product link on click
  tile.addEventListener("click", () => {
    window.open(product.url, "_blank");
  });

  container.appendChild(tile);
}

function createSection(parent: HTMLElement, title: string, products: Product[], containerId: string): HTMLElement {
  const section = document.createElement("div");
  section.className = "itrack-section";
  section.innerHTML = `<h2 class="itrack-section-title">${escapeHtml(title)}</h2><div id="${containerId}" class="itrack-tiles"></div>`;
  parent.appendChild(section);
  const container = section.querySelector(`#${containerId}`) as HTMLElement;
  products.forEach(p => renderTile(container, p));
  return container;
}

function createReopenPill(): void {
  if (document.getElementById(REOPEN_ID)) return;
  const pill = document.createElement("button");
  pill.id = REOPEN_ID;
  pill.type = "button";
  pill.className = "itrack-reopen-pill itrack-reopen-hidden";
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
  removeInstagramUI();
  const panel = getOrCreatePanel();
  panel.classList.remove("itrack-panel-hidden");

  const content = document.createElement("div");
  content.className = "itrack-content";
  panel.appendChild(content);

  createSection(content, "Recommended products", MOCK_RECOMMENDED, "itrack-recommended-tiles");
  createSection(content, "All products", MOCK_ALL, "itrack-all-tiles");

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
  if (!recContainer || !allContainer) return;
  recContainer.innerHTML = "";
  allContainer.innerHTML = "";
  recommended.forEach(p => renderTile(recContainer, p));
  all.forEach(p => renderTile(allContainer, p));
}) as EventListener);

// Image conversion to Base64
const asBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });

// clean output value
const format = (value) => JSON.stringify(value, null, 2);


try {
  const fileInput = document.getElementById("imageFile"); // Replace with the actual file that is being sent
  const file = fileInput.files && fileInput.files[0]; // Might need to change since you are uploading a file in a different way
  if (!file) {
    throw new Error("Please choose an image file.");
  }

  const screenshotB64 = await asBase64(file); // get the actual base64 string of the image file
  if (!screenshotB64) {
    throw new Error("Image conversion to base64 failed.");
  }

  const baseUrl = 'http://127.0.0.1:8000'; // Replace later with actual backend URL
  const body = {
    user_id: 'frontend-test-user',
    dwell_duration_ms: 2400,
    screenshot_b64: screenshotB64,
  };

  const response = await fetch(`${baseUrl}/dwell`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  const clean_response = format(parsed); // RESPONSE!

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
} catch (error) {
  console.error(format({error: String(error)})); // error
}

export {}