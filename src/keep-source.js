/**
 * Machinery for the `--keep-source` feature: the round-trip markers, layout
 * presets, the marker-aware regex, and template handling.
 *
 * Internal module: `package.json` only exports `src/index.js`, so nothing here
 * is part of the public package API.
 */

/** Marker comments that delimit a `--keep-source` region so re-runs are idempotent. */
const MERMAID_SOURCE_BEGIN = "<!-- mermaid:begin -->";
const MERMAID_SOURCE_END = "<!-- mermaid:end -->";

/** Matches a begin/end marker with the same whitespace tolerance as {@link createKeepSourceRegex}. */
const BEGIN_MARKER_REGEX = /<!--[^\S\n]*mermaid:begin[^\S\n]*-->/;
const END_MARKER_REGEX = /<!--[^\S\n]*mermaid:end[^\S\n]*-->/;

/**
 * Built-in layout presets for `--keep-source`. Every preset wraps the image and
 * source inside the begin/end markers: the markers (not the visual layout) are
 * what make re-runs idempotent, so they are always emitted regardless of preset.
 * Placeholders: `{{image}}`, `{{source}}`, `{{summary}}`.
 *
 * The blank lines around the HTML-comment markers are deliberate: they keep the
 * emitted Markdown stable under Prettier (and similar formatters), so running a
 * formatter over the output does not introduce spurious diffs.
 *
 * @type {Record<string, string>}
 */
const KEEP_SOURCE_PRESETS = {
  plain: [
    MERMAID_SOURCE_BEGIN,
    "",
    "{{image}}",
    "",
    "```mermaid",
    "{{source}}",
    "```",
    "",
    MERMAID_SOURCE_END,
  ].join("\n"),
  collapsed: [
    MERMAID_SOURCE_BEGIN,
    "",
    "{{image}}",
    "<details>",
    "<summary>{{summary}}</summary>",
    "",
    "```mermaid",
    "{{source}}",
    "```",
    "",
    "</details>",
    MERMAID_SOURCE_END,
  ].join("\n"),
};

/**
 * Creates the regex used to find mermaid blocks in Markdown when `--keep-source`
 * is enabled. It matches EITHER:
 *   (a) a previously-emitted, marker-delimited region — consumed as a whole so a
 *       re-run replaces the old image+source together and never nests a new
 *       wrapper inside the old one (capture group 1 = source); OR
 *   (b) a bare ```mermaid fence on the first run (capture group 2 = source).
 *
 * Every scan inside branch (a) is tempered with `notMarker` so it can never
 * cross another begin/end marker. This keeps matching linear (no catastrophic
 * backtracking on input that has a begin marker but no matching end) and stops
 * one region from swallowing the diagrams that follow it when a marker is
 * missing or malformed.
 *
 * A fresh instance is returned so each call gets its own `lastIndex`.
 *
 * @returns {RegExp} A new global, multiline regex.
 */
function createKeepSourceRegex() {
  // A single character that does NOT start another mermaid:begin/end marker.
  const notMarker =
    "(?:(?!<!--[^\\S\\n]*mermaid:(?:begin|end)[^\\S\\n]*-->)[\\s\\S])";
  return new RegExp(
    "(?:" +
      "<!--[^\\S\\n]*mermaid:begin[^\\S\\n]*-->" +
      notMarker +
      "*?" +
      "[`:]{3}mermaid[^\\S\\n]*\\r?\\n(" +
      notMarker +
      "*?)\\r?\\n[^\\S\\n]*[`:]{3}[^\\S\\n]*" +
      notMarker +
      "*?" +
      "<!--[^\\S\\n]*mermaid:end[^\\S\\n]*-->" +
      ")|(?:" +
      "^[^\\S\\n]*[`:]{3}mermaid[^\\S\\n]*\\r?\\n([\\s\\S]*?)[`:]{3}[^\\S\\n]*$" +
      ")",
    "gm",
  );
}

/**
 * Resolves the `--keep-source` layout template for a style preset. Presets are
 * `{{placeholder}}` templates internally, so a user-facing custom-template
 * option can be added here later without restructuring.
 *
 * @param {string} [sourceStyle] - Preset name (`plain` or `collapsed`).
 * @returns {string} The preset template (always contains both markers).
 * @throws {Error} If the style is unknown.
 */
function resolveKeepSourceTemplate(sourceStyle) {
  const preset = KEEP_SOURCE_PRESETS[sourceStyle ?? "plain"];
  if (!preset) {
    throw new Error(
      `Unknown sourceStyle "${sourceStyle}". ` +
        `Expected one of: ${Object.keys(KEEP_SOURCE_PRESETS).join(", ")}.`,
    );
  }
  return preset;
}

/**
 * Whether the text contains a keep-source begin or end marker. Used to warn
 * when a previously `--keep-source`-rendered file is re-rendered without the
 * flag, which would duplicate the image and orphan the markers.
 *
 * @param {string} text - Markdown text to check.
 * @returns {boolean} True if a begin or end marker is present.
 */
function hasKeepSourceMarkers(text) {
  return BEGIN_MARKER_REGEX.test(text) || END_MARKER_REGEX.test(text);
}

/**
 * Extracts the mermaid source from a match of {@link createKeepSourceRegex}:
 * group 1 holds it for an existing marker-delimited region, group 2 for a bare
 * fence. Keeps the group numbering knowledge next to the regex that defines it.
 *
 * @param {RegExpMatchArray | string[]} match - A match (or `String#replace`
 * callback arguments) produced by the keep-source regex.
 * @returns {string} The mermaid source.
 */
function sourceFromMatch(match) {
  return /** @type {string} */ (match[1] ?? match[2]);
}

/**
 * Interpolates `{{placeholder}}` tokens in a `--keep-source` template. Unknown
 * placeholders are left untouched.
 *
 * @param {string} template - Template containing `{{name}}` placeholders.
 * @param {Record<string, string>} vars - Values to substitute.
 * @returns {string} The interpolated string.
 */
function applyKeepSourceTemplate(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/**
 * Escapes HTML metacharacters so a value can be safely placed in HTML text or
 * an attribute (e.g. the `collapsed` preset's `<summary>`), without breaking
 * the markup.
 *
 * @param {string} text - Raw text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export {
  MERMAID_SOURCE_BEGIN,
  MERMAID_SOURCE_END,
  KEEP_SOURCE_PRESETS,
  createKeepSourceRegex,
  resolveKeepSourceTemplate,
  sourceFromMatch,
  applyKeepSourceTemplate,
  escapeHtml,
  hasKeepSourceMarkers,
};
