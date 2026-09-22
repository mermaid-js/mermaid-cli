import {
  parseFontFamily,
  stringifyCSSSrc,
  tokenizeCSSSrc,
} from "./tokenizeCSS.js";

/**
 * Convert a {@link Blob} to a `data://` URL.
 *
 * @param {Blob} blob - The blob to convert.
 * @returns {Promise<string>} A promise that resolves to the `data://` URL.
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve(/** @type {string} */ (reader.result)),
    );
    reader.addEventListener("error", () =>
      reject(new Error("Failed to read font file")),
    );
    reader.readAsDataURL(blob);
  });
}

/**
 * Attempt to find the license text for a given `.css` URL.
 *
 * @param {URL} url - The URL of the `.css` file to find the license for.
 */
async function loadLicense(url) {
  return await Promise.any(
    [
      "./LICENSE",
      "./LICENSE.txt",
      "./LICENSE.md",
      "../LICENSE",
      "../LICENSE.txt",
      "../LICENSE.md",
    ].map(async (path) => {
      const response = await fetch(new URL(path, url));
      if (!response.ok) {
        throw new Error(`Failed to fetch license from ${path}`);
      }
      return response.text();
    }),
  );
}

const fontAwesomeFontClasses = /** @type {const} */ ([
  "fa",
  "fab",
  "fak",
  "fal",
  "far",
  "fas",
]);

/**
 * Embed fonts used in an SVG element by analyzing the document's linked CSS stylesheets.
 *
 * Looks for `<link class="mermaid-cli-css">` elements in the `document` to find the relevant CSS stylesheets.
 * Then checks each stylesheet to see if it contains `@font-face` rules for any of the used font families,
 * or style rules whose selectors match elements inside the SVG (e.g. the Font Awesome `.fab` base rules).
 * If so, it replaces the font `url()` with a base64-encoded data URL,
 * and adds the CSS as a `<style>` element in the `<svg>`.
 *
 * Fails if it can't find licensing information to embed into the CSS.
 *
 * @param {Object} params - Params
 * @param {Document} params.document - The document containing the `<link>` elements.
 * @param {SVGSVGElement} params.svg - The SVG element to embed fonts into.
 */
export async function fontEmbedder({ document, svg }) {
  /** @type {Set<string>} */
  const usedFontFamilies = new Set();
  svg.querySelectorAll("*").forEach((el) => {
    if (
      [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE) ||
      fontAwesomeFontClasses.some((cls) => el.classList.contains(cls))
    ) {
      const [firstFontFamily] = parseFontFamily(
        window.getComputedStyle(el).fontFamily,
      );
      usedFontFamilies.add(firstFontFamily);
    }
  });

  /**
   * Check whether a CSS style rule applies to any element inside the SVG.
   *
   * Pseudo-elements (e.g. `::before`) are removed, since `querySelector`
   * can't match them, but the rule still applies to the originating element.
   *
   * @param {CSSStyleRule} rule
   */
  function ruleAppliesToSVG(rule) {
    const selector = rule.selectorText.replaceAll(
      /::[\w-]+|:(before|after|first-letter|first-line)\b/g,
      "",
    );
    return svg.matches(selector) || svg.querySelector(selector) !== null;
  }

  /** @type {Promise<string>[]} */
  const newCSSStyleSheets = [];

  document.querySelectorAll("link").forEach((link) => {
    // For TypeScript reasons, we're not putting this in the querySelector
    if (!link.classList.contains("mermaid-cli-css")) {
      return;
    }
    const cssStyleSheet = link.sheet;
    if (!cssStyleSheet) {
      return;
    }
    /** @type {Set<string>} Set of src rules for used font families */
    const srcRules = new Set();
    /** Set to `true` if any style rule in the stylesheet applies to the SVG */
    let hasMatchingRule = false;
    /** @type {CSSRule['cssText'][]} List of CSS rule texts to include in the new stylesheet */
    const cssRulesText = [];
    for (const rule of cssStyleSheet.cssRules) {
      if (rule instanceof CSSFontFaceRule) {
        const [fontFamily] = parseFontFamily(rule.style.fontFamily);
        if (!usedFontFamilies.has(fontFamily)) {
          continue;
        }
        if ("src" in rule.style && typeof rule.style.src === "string") {
          srcRules.add(rule.style.src);
        } else {
          throw new Error(
            "Font face rule for used font family does not have a valid src",
          );
        }
      } else if (!hasMatchingRule && rule instanceof CSSStyleRule) {
        hasMatchingRule = ruleAppliesToSVG(rule);
      }

      // Push everything, except unused @font-face rules
      cssRulesText.push(rule.cssText);
    }

    if (srcRules.size === 0 && !hasMatchingRule) {
      return;
    }

    newCSSStyleSheets.push(
      (async () => {
        const [license, ...replacements] = await Promise.all([
          loadLicense(new URL(link.href)),
          ...[...srcRules].map(async (src) => {
            const srcTokens = tokenizeCSSSrc(src);
            const fontSrcToken =
              srcTokens.find(
                (token) =>
                  token?.format === "woff2" || token.url?.includes("woff2"),
              ) || srcTokens[0];
            if (!fontSrcToken || !fontSrcToken.url) {
              throw new Error(
                "No valid font src token found for used font family",
              );
            }
            const fontResponse = await fetch(
              new URL(fontSrcToken.url, link.href),
            );
            if (!fontResponse.ok) {
              throw new Error(`Failed to fetch font from ${fontSrcToken.url}`);
            }

            const fontAsDataURL = await blobToDataURL(
              await fontResponse.blob(),
            );

            return {
              oldSrc: src,
              newSrc: stringifyCSSSrc([
                { ...fontSrcToken, url: fontAsDataURL },
              ]),
            };
          }),
        ]);
        const newCSS =
          `/* ${
            // Make sure that the license comment doesn't break by adding a zero-width space.
            license.replaceAll("*/", "*​/")
          } */\n\n` +
          replacements.reduce((css, { oldSrc, newSrc }) => {
            // This might break due to different escaping or formatting of the old src in the CSS.
            // However, it's probably good enough for now and simple CSS files.
            const newCSS = css.replace(oldSrc, newSrc);
            if (newCSS === css) {
              // This might happen if the old src had some different escaping
              throw new Error(
                `Failed to replace old src with new src for ${oldSrc}`,
              );
            }
            return newCSS;
          }, cssRulesText.join("\n"));
        return newCSS;
      })(),
    );
  });

  for (const newCSS of await Promise.all(newCSSStyleSheets)) {
    const originalStyleElement = svg.querySelector("style");
    if (originalStyleElement === null) {
      throw new Error("Failed to find original style element in SVG");
    }
    const newStyleElement = originalStyleElement.insertAdjacentElement(
      "afterend",
      document.createElementNS("http://www.w3.org/2000/svg", "style"),
    );
    if (newStyleElement === null) {
      throw new Error("Failed to create new style element for SVG");
    }
    newStyleElement.textContent = newCSS;
  }
}
