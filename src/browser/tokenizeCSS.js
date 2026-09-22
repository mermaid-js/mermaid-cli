/**
 * @typedef {object} CSSSourceToken
 * @property {string} [url] - The URL of the CSS source.
 * @property {string} [format] - The format of the CSS source.
 * @property {string} [tech] - The technology of the CSS source.
 * @property {string} [local] - The local identifier of the CSS source.
 */

/**
 * Converts an array of CSS source tokens into a CSS `src` attribute string.
 *
 * The reverse of {@link tokenizeCSSSrc}.
 *
 * @param {CSSSourceToken[]} tokens - The array of CSS source tokens to stringify.
 */
export function stringifyCSSSrc(tokens) {
  return tokens
    .map((token) => {
      const parts = [];
      if (token.url) {
        parts.push(`url(${JSON.stringify(token.url)})`);
      }
      if (token.format) {
        parts.push(`format(${JSON.stringify(token.format)})`);
      }
      if (token.tech) {
        parts.push(`tech(${token.tech})`);
      }
      if (token.local) {
        // TODO: I think we might need to escape this for standard compliance
        parts.push(`local(${token.local})`);
      }
      return parts.join(" ");
    })
    .join(", ");
}

/**
 * Parses a {@link CSSStyleDeclaration#fontFamily} string into an array of font family names.
 *
 * @param {string} string - The font family string to parse.
 * @returns {string[]} - An array of font family names.
 * @example
 * parseFontFamily('"Hello, World", Hello, World, Hello World, \22 toto\22');
 * // Returns: ["Hello, World", "Hello", "World", "Hello World", '"toto"']
 */
export function parseFontFamily(string) {
  /** @type {string[]} */
  const fontFamilies = [];
  const len = string.length;
  let i = 0;

  function skipWhitespace() {
    while (i < len && isWhitespace(string[i])) {
      i++;
    }
  }

  while (i < len) {
    skipWhitespace();
    let parsed;
    if ((parsed = readQuotedString(string.slice(i)))) {
      fontFamilies.push(parsed.parsed);
      i += parsed.tokens;
    } else {
      let fontFamilyParts = [];
      const originalI = i;
      while (i < len && (parsed = readIdentToken(string.slice(i)))) {
        fontFamilyParts.push(parsed.parsed);
        i += parsed.tokens;
        skipWhitespace();
      }
      if (fontFamilyParts.length === 0) {
        throw new Error(
          "Failed to parse font family from string: " + string.slice(originalI),
        );
      }
      fontFamilies.push(fontFamilyParts.join(" "));
    }
    skipWhitespace();
    if (i < len && string[i] === ",") {
      i++; // consume ','
    }
  }
  return fontFamilies;
}

/**
 * @param {string} string - Parse the given CSS `src` attribute value.
 */
export function tokenizeCSSSrc(string) {
  /** @type {CSSSourceToken[]} */
  const sources = [];
  const len = string.length;
  let i = 0;

  function skipWhitespace() {
    while (i < len && isWhitespace(string[i])) {
      i++;
    }
  }

  skipWhitespace();
  while (i < len) {
    /** @type {CSSSourceToken} */
    const source = {};
    while (i < len && string[i] !== ",") {
      skipWhitespace();
      if (i >= len || string[i] === ",") {
        break;
      }
      const urlToken = readUrlToken(string.slice(i));
      if (urlToken) {
        source.url = urlToken.parsed;
        i += urlToken.tokens;
        skipWhitespace();
        continue;
      }

      const ident = readIdentToken(string.slice(i));
      if (!ident) {
        throw new Error(
          "Failed to read identifier token from: " + string.slice(i),
        );
      }
      i += ident.tokens;
      skipWhitespace();
      if (i < len && string[i] === "(") {
        i++; // consume '('
        skipWhitespace();
        let value = "";
        let parsed;
        if ((parsed = readQuotedString(string.slice(i)))) {
          value = parsed.parsed;
          i += parsed.tokens;
        } else if ((parsed = readIdentToken(string.slice(i)))) {
          value = parsed.parsed;
          i += parsed.tokens;
        }
        skipWhitespace();
        if (i < len && string[i] === ")") {
          i++; // consume ')'
        }
        if (
          ident.parsed === "url" ||
          ident.parsed === "format" ||
          ident.parsed === "tech" ||
          ident.parsed === "local"
        ) {
          source[ident.parsed] = value;
        }
      }
      skipWhitespace();
    }
    if (Object.keys(source).length > 0) {
      sources.push(source);
    }
    if (i < len && string[i] === ",") {
      i++; // consume ','
    }
    skipWhitespace();
  }

  return sources;
}

/**
 * @param {string} ch - Character to check.
 * @see https://drafts.csswg.org/css-syntax-3/#whitespace-diagram
 */
function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\n";
}

/**
 * @param {string} string - Parses a CSS escape sequence starting at the beginning of the string.
 */
function readEscape(string) {
  if (string[0] !== "\\") {
    return undefined;
  }
  let hex = "";
  let i = 1; // start after the backslash
  while (i < string.length && hex.length < 6 && /[0-9a-fA-F]/.test(string[i])) {
    hex += string[i];
    i++;
  }
  if (hex.length > 0) {
    // A single trailing whitespace is part of the hex escape.
    if (i < string.length && isWhitespace(string[i])) {
      i++;
    }
    return { parsed: String.fromCodePoint(parseInt(hex, 16)), tokens: i };
  } else if (string[i]) {
    return { parsed: string[i], tokens: i + 1 };
  } else {
    throw new Error("Invalid escape sequence: " + string);
  }
}

/**
 * @param {string} string - Parses a CSS string sequence starting at the beginning of the string.
 * @see https://drafts.csswg.org/css-syntax-3/#typedef-string-token
 */
function readQuotedString(string) {
  const quote = string[0];
  if (quote !== '"' && quote !== "'") {
    return undefined;
  }
  let i = 1; // consume opening quote
  let result = "";
  while (i < string.length) {
    const ch = string[i];
    let parsed;
    if ((parsed = readEscape(string.slice(i)))) {
      result += parsed.parsed;
      i += parsed.tokens;
    } else if (ch === quote) {
      return {
        parsed: result,
        tokens: i + 1,
      };
    } else {
      result += ch;
      i++;
    }
  }
  throw new Error("Unterminated quoted string: " + string);
}

/**
 * @param {string} string - Read an `ident-token`
 * @see https://drafts.csswg.org/css-syntax-3/#typedef-ident-token
 */
function readIdentToken(string) {
  let i = 0;
  let ident = "";
  if (string.startsWith("--")) {
    i += 2;
    ident += "--";
  } else {
    if (string.startsWith("-")) {
      i += 1;
      ident += "-";
    }
    let parsed;
    if ((parsed = readEscape(string.slice(i)))) {
      ident += parsed.parsed;
      i += parsed.tokens;
      // eslint-disable-next-line no-control-regex -- Needed to allow non-ASCII characters
    } else if (i < string.length && string[i].match(/[a-zA-Z_]|[^\x00-\x7F]/)) {
      ident += string[i];
      i++;
    } else {
      // No valid starting sequence for an ident found
      return undefined;
    }
  }

  while (i < string.length) {
    let parsed;
    if ((parsed = readEscape(string.slice(i)))) {
      ident += parsed.parsed;
      i += parsed.tokens;
      // eslint-disable-next-line no-control-regex -- Needed to allow non-ASCII characters
    } else if (string[i].match(/[a-zA-Z0-9_-]|[^\x00-\x7F]/)) {
      ident += string[i];
      i++;
    } else {
      break;
    }
  }
  return { parsed: ident, tokens: i };
}

/**
 * @param {string} string - Parses a CSS `url-token` starting at the beginning of the string.
 * @see https://drafts.csswg.org/css-syntax-3/#typedef-url-token
 */
function readUrlToken(string) {
  let i = 0; // consume leading whitespace
  let ident = readIdentToken(string);
  if (!ident || ident.parsed !== "url") {
    return undefined; // Not URL token
  }
  i += ident.tokens;
  if (string[i] !== "(") {
    return undefined; // Not a valid URL token
  }
  i++; // consume '('
  while (i < string.length && isWhitespace(string[i])) {
    i++;
  }

  let url = "";

  while (i < string.length) {
    let parsed;
    if ((parsed = readEscape(string.slice(i)))) {
      url += parsed.parsed;
      i += parsed.tokens;
      // eslint-disable-next-line no-control-regex -- Matching non-printable chars
    } else if (string[i].match(/[^"'()\\\x00-\x08\x0B\x0E-\x1F\x7F]/)) {
      url += string[i];
      i++;
    } else {
      break;
    }
  }

  while (i < string.length && isWhitespace(string[i])) {
    i++;
  }

  if (string[i] !== ")") {
    return undefined; // Not a valid URL token
  }
  i++; // consume ')'
  return { parsed: url, tokens: i };
}
