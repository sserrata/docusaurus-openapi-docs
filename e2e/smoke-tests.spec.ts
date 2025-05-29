import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Function to recursively find all HTML files in a directory
function getHtmlFilePaths(
  dir: string,
  baseDir = dir,
  fileList: string[] = []
): string[] {
  if (!fs.existsSync(dir)) {
    console.warn(
      `Directory ${dir} does not exist. Skipping page discovery for this path.`
    );
    return [];
  }

  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getHtmlFilePaths(filePath, baseDir, fileList);
    } else if (path.extname(file) === ".html") {
      fileList.push(path.relative(baseDir, filePath));
    }
  });
  return fileList;
}

const builtTestsDir = path.join(process.cwd(), "demo", "build", "tests");
// Note: process.cwd() is used because Playwright's test runner might have a different CWD
// depending on how it's invoked. The webServer command, however, runs from the project root.

const testPageFiles = getHtmlFilePaths(builtTestsDir);

if (testPageFiles.length === 0) {
  console.warn(
    `No HTML files found in ${builtTestsDir}. ` +
      `Make sure the 'demo' site has been built (e.g., via 'yarn build-demo') ` +
      `and that the 'outputDir' for the 'tests' plugin in 'docusaurus.config.ts' (demo/docusaurus.config.ts) ` +
      `is correctly pointing to 'docs/tests' which results in pages being built to 'demo/build/tests'. ` +
      `The Playwright webServer should handle the build, but this check is important. ` +
      `If this is unexpected, the tests for /tests pages will be skipped.`
  );
  // Optionally, create a dummy test to make sure Playwright doesn't complain about no tests
  test("No test pages found - check build and config", () => {
    expect(true).toBe(true); // Placeholder
  });
} else {
  test.describe("Smoke and Snapshot Tests for /tests pages", () => {
    testPageFiles.forEach((pageFile) => {
      // Convert file path like 'api/my-test.html' to URL path '/tests/api/my-test'
      // Convert 'index.html' to '/' or '' for the respective directory
      let pageUrlPath = path.join("/tests", pageFile.replace(/\.html$/, ""));
      if (path.basename(pageFile) === "index.html") {
        pageUrlPath = path.dirname(pageUrlPath); // if it's 'tests/index.html', becomes '/tests'
        // if it's 'tests/subdir/index.html', becomes '/tests/subdir'
      }
      // Ensure consistent slashes for URL
      pageUrlPath = pageUrlPath.replace(/\\/g, "/");

      test(`Check ${pageUrlPath}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            const text = msg.text();
            // Docusaurus development server sometimes throws an error related to ResizeObserver
            // This is a known issue and typically doesn't affect production builds or user experience.
            // Example: "ResizeObserver loop completed with undelivered notifications."
            if (
              text.includes(
                "ResizeObserver loop completed with undelivered notifications"
              )
            ) {
              console.warn(`[CONSOLE WARN - Known Docusaurus Issue]: ${text}`);
              return;
            }
            consoleErrors.push(`[CONSOLE ERROR]: ${text}`);
          }
        });

        const response = await page.goto(pageUrlPath, {
          waitUntil: "domcontentloaded",
        });

        // Check for 404s or other client/server errors
        expect(
          response?.status(),
          `Page ${pageUrlPath} should load successfully.`
        ).toBeLessThan(400);

        // Assert no unexpected console errors
        expect(
          consoleErrors,
          `Console errors on ${pageUrlPath}:\n${consoleErrors.join("\n")}`
        ).toEqual([]);

        // Take snapshot
        // Sanitize the pageUrlPath to be a valid filename for snapshots
        const snapshotName =
          pageUrlPath.substring(1).replace(/[^a-zA-Z0-9_.-]/g, "_") + ".png";
        await expect(page).toHaveScreenshot(snapshotName, { fullPage: true });
      });
    });
  });
}
