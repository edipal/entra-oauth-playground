import { describe, expect, it } from "vitest";
// @ts-ignore - CommonJS module from .agents
import serverModule from "../.agents/skills/brainstorming/scripts/server.cjs";

const { decodeFrame, encodeFrame, OPCODES } = serverModule;

describe("brainstorming server decodeFrame", () => {
  it("decodes a valid masked text frame", () => {
    const payload = Buffer.from("hello world");
    const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
    const maskedPayload = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
      maskedPayload[i] = payload[i] ^ mask[i % 4];
    }

    const header = Buffer.from([0x81, 0x80 | payload.length]);
    const frame = Buffer.concat([header, mask, maskedPayload]);

    const result = decodeFrame(frame);
    expect(result).not.toBeNull();
    expect(result?.opcode).toBe(OPCODES.TEXT);
    expect(result?.payload.toString()).toBe("hello world");
  });

  it("rejects unmasked client frames", () => {
    const frame = Buffer.from([0x81, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(() => decodeFrame(frame)).toThrow(/Client frames must be masked/);
  });

  it("throws when 64-bit frame length exceeds MAX_PAYLOAD_SIZE", () => {
    // 64-bit length header (payloadLen = 127) specifying 2 MB length (> 1 MB MAX_PAYLOAD_SIZE)
    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127; // masked + length 127
    header.writeBigUInt64BE(BigInt(2 * 1024 * 1024), 2);

    expect(() => decodeFrame(header)).toThrow(
      /Frame payload exceeds maximum allowed size/,
    );
  });
});
