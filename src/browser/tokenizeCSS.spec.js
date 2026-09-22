import { expect, describe, test } from "@jest/globals";

import { tokenizeCSSSrc, parseFontFamily } from "./tokenizeCSS.js";

describe("tokenizeCSSSrc", () => {
  test("should parse a simple CSS src string", () => {
    const input =
      'url(\'https://example.com/font.woff2?quotedQueryParam=\\\'"Hello, World"\\27\'  ), url(  ./font.tiff) format("woff") tech(color-COLRv1)';
    const result = tokenizeCSSSrc(input);
    expect(result).toEqual([
      {
        url: "https://example.com/font.woff2?quotedQueryParam='\"Hello, World\"'",
      },
      {
        url: "./font.tiff",
        format: "woff",
        tech: "color-COLRv1",
      },
    ]);
  });
});

describe("parseFontFamily", () => {
  test("should parse some complicated font families", () => {
    const input = String.raw`"Hello, World", Hello, World, Hello World, \22 toto\22`;
    const result = parseFontFamily(input);
    expect(result).toEqual([
      "Hello, World",
      "Hello",
      "World",
      "Hello World",
      '"toto"',
    ]);
  });
});
