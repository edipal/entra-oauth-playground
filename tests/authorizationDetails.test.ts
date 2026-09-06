import { describe, expect, it } from "vitest";
import {
  MAX_AUTHORIZATION_DETAILS_LENGTH,
  normalizeAuthorizationDetailsParam,
  validateAuthorizationDetails,
} from "@/lib/authorizationDetails";

const errorKeyOf = (input: string) => {
  const result = validateAuthorizationDetails(input);
  return result.status === "invalid" ? result.errorKey : result.status;
};

describe("validateAuthorizationDetails", () => {
  it("treats blank input as absent rather than invalid", () => {
    expect(validateAuthorizationDetails("")).toEqual({ status: "empty" });
    expect(validateAuthorizationDetails("   \n ")).toEqual({ status: "empty" });
    expect(validateAuthorizationDetails(undefined)).toEqual({
      status: "empty",
    });
  });

  it("accepts a well-formed RAR array", () => {
    const result = validateAuthorizationDetails(
      '[{"type":"payment_initiation","locations":["https://api.example.com"]}]',
    );
    expect(result.status).toBe("valid");
  });

  it("rejects malformed JSON", () => {
    expect(errorKeyOf("{")).toBe("rarInvalidJson");
    expect(errorKeyOf("not json")).toBe("rarInvalidJson");
    expect(errorKeyOf('[{"type":"a"},]')).toBe("rarInvalidJson");
  });

  it("requires an array at the top level", () => {
    expect(errorKeyOf('{"type":"a"}')).toBe("rarNotArray");
    expect(errorKeyOf('"a string"')).toBe("rarNotArray");
    expect(errorKeyOf("42")).toBe("rarNotArray");
    expect(errorKeyOf("null")).toBe("rarNotArray");
  });

  it("requires at least one entry", () => {
    expect(errorKeyOf("[]")).toBe("rarEmptyArray");
  });

  it("requires every entry to be an object", () => {
    expect(errorKeyOf("[null]")).toBe("rarEntryNotObject");
    expect(errorKeyOf('["a"]')).toBe("rarEntryNotObject");
    expect(errorKeyOf('[[{"type":"a"}]]')).toBe("rarEntryNotObject");
    expect(errorKeyOf('[{"type":"a"},7]')).toBe("rarEntryNotObject");
  });

  it("requires a non-empty string type on every entry", () => {
    expect(errorKeyOf("[{}]")).toBe("rarEntryMissingType");
    expect(errorKeyOf('[{"type":""}]')).toBe("rarEntryMissingType");
    expect(errorKeyOf('[{"type":"   "}]')).toBe("rarEntryMissingType");
    expect(errorKeyOf('[{"type":123}]')).toBe("rarEntryMissingType");
    expect(errorKeyOf('[{"type":"a"},{"nope":1}]')).toBe("rarEntryMissingType");
  });

  it("caps the compacted payload size", () => {
    const padded = (length: number) =>
      JSON.stringify([{ type: "a", pad: "x".repeat(length) }]);

    expect(errorKeyOf(padded(5000))).toBe("rarTooLarge");
    // guards oversized raw input before parsing it
    expect(errorKeyOf(padded(MAX_AUTHORIZATION_DETAILS_LENGTH * 5))).toBe(
      "rarTooLarge",
    );
  });

  it("accepts indented input whose compacted form fits the cap", () => {
    const pretty = JSON.stringify(
      [{ type: "a", pad: "y".repeat(3000) }],
      null,
      2,
    );
    expect(pretty.length).toBeGreaterThan(3000);
    expect(validateAuthorizationDetails(pretty).status).toBe("valid");
  });

  it("returns compact JSON so the authorize URL carries no stray whitespace", () => {
    const result = validateAuthorizationDetails(
      '[\n  {\n    "type": "payment_initiation",\n    "locations": ["https://api.example.com"]\n  }\n]',
    );
    expect(result.status === "valid" && result.value).toBe(
      '[{"type":"payment_initiation","locations":["https://api.example.com"]}]',
    );
  });
});

describe("normalizeAuthorizationDetailsParam", () => {
  it("passes through params without authorization_details", () => {
    const params = { client_id: "abc" };
    expect(normalizeAuthorizationDetailsParam(params)).toEqual(params);
  });

  it("treats a blank value as absent", () => {
    const params = { client_id: "abc", authorization_details: "  " };
    expect(normalizeAuthorizationDetailsParam(params)).toEqual(params);
  });

  it("normalizes a valid value in place", () => {
    expect(
      normalizeAuthorizationDetailsParam({
        client_id: "abc",
        authorization_details: '[ {"type":"a"} ]',
      }),
    ).toEqual({ client_id: "abc", authorization_details: '[{"type":"a"}]' });
  });

  it("returns null for anything invalid so the caller can refuse the request", () => {
    expect(
      normalizeAuthorizationDetailsParam({
        client_id: "abc",
        authorization_details: "[{}]",
      }),
    ).toBeNull();
    expect(
      normalizeAuthorizationDetailsParam({
        client_id: "abc",
        authorization_details: "{",
      }),
    ).toBeNull();
    expect(
      normalizeAuthorizationDetailsParam({
        client_id: "abc",
        authorization_details: 123 as unknown as string,
      }),
    ).toBeNull();
    expect(
      normalizeAuthorizationDetailsParam({
        client_id: "abc",
        authorization_details: {} as unknown as string,
      }),
    ).toBeNull();
  });
});
