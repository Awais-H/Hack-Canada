#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.DWELL_BASE_URL ?? "http://127.0.0.1:8000";
const inputImagePath = process.env.DWELL_TEST_IMAGE ?? "image.png";
const outputDir = process.env.DWELL_OUTPUT_DIR ?? "tmp";

const payload = {
  user_id: process.env.DWELL_TEST_USER ?? "dwell-test-user",
  page_url: process.env.DWELL_TEST_PAGE_URL ?? "https://www.instagram.com/reel/test",
  page_title: process.env.DWELL_TEST_PAGE_TITLE ?? "Pinned Test Reel",
  dwell_duration_ms: Number(process.env.DWELL_TEST_DURATION_MS ?? 2600),
};

const toBase64 = async (filePath) => {
  const imageBuffer = await readFile(filePath);
  return imageBuffer.toString("base64");
};

const saveInputSampleImage = async (filePath) => {
  const imageBuffer = await readFile(filePath);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "sample-input-image.png");
  await writeFile(outputPath, imageBuffer);
  return outputPath;
};

const pingHealth = async () => {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const postDwell = async (body) => {
  const response = await fetch(`${baseUrl}/dwell`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  const json = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(`Dwell request failed: ${response.status} ${response.statusText}\n${responseText}`);
  }

  return json;
};

const normalizeUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }
  return url.replace(/\s+/g, "").trim();
};

const downloadSampleImage = async (imageUrl) => {
  const normalizedUrl = normalizeUrl(imageUrl);
  if (!normalizedUrl) {
    return null;
  }

  const response = await fetch(normalizedUrl);
  if (!response.ok) {
    throw new Error(`Image download failed for ${normalizedUrl}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "sample-product.jpg");
  await writeFile(outputPath, bytes);
  return { outputPath, sourceUrl: normalizedUrl };
};

const run = async () => {
  const screenshotB64 = await toBase64(inputImagePath);
  const inputSamplePath = await saveInputSampleImage(inputImagePath);

  console.log(`Using test image: ${inputImagePath}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Saved input sample image to: ${inputSamplePath}`);

  console.log("[Test] Pinging health")
  const health = await pingHealth();
  console.log("Health status:", health);

  const dwellBody = {
    ...payload,
    screenshot_b64: screenshotB64,
  };

  const dwellResponse = await postDwell(dwellBody);

  console.log("\n[Test] Dwell response (summary):");
  console.log(`- Current product: ${dwellResponse.current_product?.name ?? "n/a"}`);
  console.log(`- Current product image: ${dwellResponse.current_product?.image_url ?? "n/a"}`);
  console.log(`- Taste picks: ${(dwellResponse.taste_picks ?? []).length}`);

  const imageCandidates = [
    dwellResponse.current_product?.image_url,
    ...(dwellResponse.taste_picks ?? []).map((pick) => pick.image_url),
  ].filter(Boolean);

  let downloaded = null;
  for (const candidate of imageCandidates) {
    try {
      downloaded = await downloadSampleImage(candidate);
      if (downloaded) {
        break;
      }
    } catch (error) {
      console.warn(`- Skipping sample image candidate: ${String(error)}`);
    }
  }

  if (downloaded) {
    console.log(`- Downloaded sample image to: ${downloaded.outputPath}`);
    console.log(`- Downloaded from URL: ${downloaded.sourceUrl}`);
  } else {
    console.log("- Could not download a sample image from the returned URLs.");
  }

  console.log("\n[Test] Full dwell respones");
  console.log(dwellResponse)
};

run().catch((error) => {
  console.error("test:dwell failed");
  console.error(error);
  process.exit(1);
});
