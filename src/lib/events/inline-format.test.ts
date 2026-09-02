import { describe, expect, it } from "vitest";
import {
  parseInlineMarks,
  stripInlineMarks,
  type InlineNode,
} from "./inline-format";

const text = (value: string): InlineNode => ({ type: "text", value });
const mark = (
  m: "bold" | "italic" | "underline",
  ...children: InlineNode[]
): InlineNode => ({ type: "mark", mark: m, children });

describe("parseInlineMarks", () => {
  it("returns a single text node for plain input", () => {
    expect(parseInlineMarks("hola mundo")).toEqual([text("hola mundo")]);
  });

  it("returns nothing for empty input", () => {
    expect(parseInlineMarks("")).toEqual([]);
  });

  it("parses bold, italic and underline", () => {
    expect(parseInlineMarks("**b**")).toEqual([mark("bold", text("b"))]);
    expect(parseInlineMarks("_i_")).toEqual([mark("italic", text("i"))]);
    expect(parseInlineMarks("++u++")).toEqual([mark("underline", text("u"))]);
  });

  it("keeps surrounding text", () => {
    expect(parseInlineMarks("a **b** c")).toEqual([
      text("a "),
      mark("bold", text("b")),
      text(" c"),
    ]);
  });

  it("parses sequential marks", () => {
    expect(parseInlineMarks("**b** and _i_")).toEqual([
      mark("bold", text("b")),
      text(" and "),
      mark("italic", text("i")),
    ]);
  });

  it("nests marks", () => {
    expect(parseInlineMarks("**a _b_ c**")).toEqual([
      mark("bold", text("a "), mark("italic", text("b")), text(" c")),
    ]);
  });

  it("renders unbalanced delimiters as literal text", () => {
    expect(parseInlineMarks("just ** stray")).toEqual([text("just ** stray")]);
    expect(parseInlineMarks("a _ b")).toEqual([text("a _ b")]);
  });

  it("does not mistake ** for two italics", () => {
    expect(parseInlineMarks("**bold**")).toEqual([mark("bold", text("bold"))]);
  });
});

describe("stripInlineMarks", () => {
  it("removes all delimiters", () => {
    expect(stripInlineMarks("**a** _b_ ++c++")).toBe("a b c");
  });

  it("leaves plain text untouched", () => {
    expect(stripInlineMarks("sin formato")).toBe("sin formato");
  });
});
