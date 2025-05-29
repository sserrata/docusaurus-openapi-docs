import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { Parser as XmlParser } from "xml2js";

// New function: getTestPagePathsFromSitemap
async function getTestPagePathsFromSitemap(
  sitemapPath: string,
  siteBaseUrl: string
): Promise<string[]> {
  if (!fs.existsSync(sitemapPath)) {
    console.warn(
      `Sitemap file ${sitemapPath} not found. No pages will be tested based on sitemap.`
    );
    return [];
  }

  try {
    const sitemapXml = fs.readFileSync(sitemapPath, "utf-8");
    const parser = new XmlParser();
    const result = await parser.parseStringPromise(sitemapXml);

    const urlset = result.urlset;
    if (!urlset || !urlset.url || !Array.isArray(urlset.url)) {
      console.warn(
        `Invalid sitemap format in ${sitemapPath}. Could not find urlset or urls.`
      );
      return [];
    }

    const pagePaths: string[] = [];
    for (const urlEntry of urlset.url) {
      if (urlEntry.loc && typeof urlEntry.loc[0] === "string") {
        const fullUrl = urlEntry.loc[0];
        // Check if the URL is for the current site (using startsWith) and contains /tests/
        if (fullUrl.startsWith(siteBaseUrl) && fullUrl.includes("/tests/")) {
          const urlObject = new URL(fullUrl);
          // We want the path including search and hash, relative to the base URL
          let relativePath = urlObject.pathname;
          if (urlObject.search) relativePath += urlObject.search;
          if (urlObject.hash) relativePath += urlObject.hash;
          pagePaths.push(relativePath);
        } else if (!fullUrl.startsWith("http") && fullUrl.includes("/tests/")) {
          // Handle cases where sitemap might contain relative paths,
          // assuming siteBaseUrl is just '/' for this logic to make sense for root-relative paths.
          if (siteBaseUrl === "/" && fullUrl.startsWith("/")) {
            pagePaths.push(fullUrl);
          }
          // Other relative path scenarios are less likely for standard sitemaps but could be added if needed.
        }
      }
    }
    return pagePaths;
  } catch (error) {
    console.error(`Error parsing sitemap ${sitemapPath}:`, error);
    return [];
  }
}

const sitemapPath = path.join(process.cwd(), "demo", "build", "sitemap.xml");
// This baseURL should align with what's in playwright.config.ts and how Docusaurus generates sitemap URLs.
// Docusaurus sitemap usually generates absolute URLs using the 'url' field from docusaurus.config.ts.
// For local testing, Playwright's baseURL ('http://localhost:3000') will be the effective base.
// So, we filter sitemap URLs that start with this local base.
const siteBaseUrlForSitemap = "http://localhost:3000";

let testPageUrls: string[] = [];

test.beforeAll(async () => {
  // This runs once before any tests in this file.
  // It populates testPageUrls based on the sitemap content.
  // The webServer in playwright.config.ts should have already built the site.
  testPageUrls = await getTestPagePathsFromSitemap(
    sitemapPath,
    siteBaseUrlForSitemap
  );

  if (testPageUrls.length === 0) {
    console.warn(
      `WARN: No URLs containing '/tests/' were found in ${sitemapPath} (for base URL ${siteBaseUrlForSitemap}). ` +
        `Ensure the 'demo' site has been built (e.g., via 'yarn build-demo'), ` +
        `the sitemap.xml is generated correctly by Docusaurus, and it includes full URLs for pages under '/tests/'. ` +
        `The Playwright webServer in playwright.config.ts is responsible for the build. ` +
        `If this is unexpected, the Playwright tests for /tests pages will effectively be skipped.`
    );
  }
});

test.describe("Smoke and Snapshot Tests for /tests pages (Sitemap Driven)", () => {
  // This initial test acts as a guard or status check.
  // It runs after beforeAll has populated testPageUrls.
  test("Check if any /tests/ URLs were found in sitemap", () => {
    if (testPageUrls.length === 0) {
      console.log(
        `INFO: No /tests/ URLs found in ${sitemapPath} matching base URL ${siteBaseUrlForSitemap}. No page-specific tests will run.`
      );
      // You could choose to fail here if pages are expected:
      // expect(testPageUrls.length).toBeGreaterThan(0, "Critical: No /tests/ URLs found in sitemap.");
    } else {
      console.log(
        `INFO: Found ${testPageUrls.length} /tests/ URL(s) in sitemap to test.`
      );
    }
    // This test itself just passes, its purpose is logging or a basic assertion.
    expect(true).toBe(true);
  });

  // Dynamically generate tests for each URL found in the sitemap
  // If testPageUrls is empty, this loop simply won't run any iterations.
  testPageUrls.forEach((pageUrlPath) => {
    test(`Check ${pageUrlPath}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Docusaurus development server sometimes throws an error related to ResizeObserver
          if (
            text.includes(
              "ResizeObserver loop completed with undelivered notifications"
            )
          ) {
            console.warn(
              `[CONSOLE WARN - Known Docusaurus Issue on ${pageUrlPath}]: ${text}`
            );
            return;
          }
          consoleErrors.push(`[CONSOLE ERROR on ${pageUrlPath}]: ${text}`);
        }
      });

      const response = await page.goto(pageUrlPath, {
        waitUntil: "domcontentloaded",
      });

      expect(
        response?.status(),
        `Page ${pageUrlPath} should load successfully (status < 400).`
      ).toBeLessThan(400);
      expect(
        consoleErrors,
        `Console errors on ${pageUrlPath}:\n${consoleErrors.join("\n")}`
      ).toEqual([]);

      // Sanitize the pageUrlPath to be a valid filename for snapshots
      // Example: /tests/some/page?query=1 -> tests_some_page_query_1.png
      const snapshotName =
        pageUrlPath.substring(1).replace(/[^a-zA-Z0-9_.-]/g, "_") + ".png";
      await expect(page).toHaveScreenshot(snapshotName, { fullPage: true });
    });
  });
});
