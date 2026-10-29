import { expect, describe, test } from "@jest/globals";

import {
  tokenizeCSSSrc,
  parseFontFamily,
  parseUnicodeRange,
} from "./tokenizeCSS.js";

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

describe("parseUnicodeRange", () => {
  test("should parse code points, intervals and wildcard ranges", () => {
    const input = " U+0-FF, U+131,u+4??,\tU+???, u+1f600-1F64f ";
    const result = parseUnicodeRange(input);
    expect(result).toEqual([
      [0x0, 0xff],
      [0x131, 0x131],
      [0x400, 0x4ff],
      [0x0, 0xfff],
      [0x1f600, 0x1f64f],
    ]);
  });

  test.each([
    "",
    "U+",
    "0-FF",
    "U+GG",
    "U+0-",
    "U+1234567",
    "U+4??-4FF",
    "U+?4",
    "U+FF-0",
    "U+110000",
  ])("should throw on invalid unicode-range %j", (input) => {
    expect(() => parseUnicodeRange(input)).toThrow();
  });
});
