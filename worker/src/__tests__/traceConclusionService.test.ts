import { describe, it, expect, vi, beforeEach } from "vitest";
import { TraceConclusionService } from "../services/TraceConclusionService";
import * as clickhouse from "@langfuse/shared/src/server";
import axios from "axios";

// Mock ClickHouse
vi.mock("@langfuse/shared/src/server", async () => {
  const actual = await vi.importActual("@langfuse/shared/src/server");
  return {
    ...actual,
    queryClickhouse: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  };
});

// Mock axios
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("TraceConclusionService", () => {
  let service: TraceConclusionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TraceConclusionService();
  });

  describe("findConcludedTraces", () => {
    it("should return trace IDs from ClickHouse query", async () => {
      const mockTraces = [
        { trace_id: "trace-1" },
        { trace_id: "trace-2" },
        { trace_id: "trace-3" },
      ];

      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce(mockTraces);

      const result = await service.findConcludedTraces();

      expect(result).toEqual(["trace-1", "trace-2", "trace-3"]);
      expect(clickhouse.queryClickhouse).toHaveBeenCalledWith({
        query: expect.stringContaining(
          "WHERE NOT has(mapKeys(t.metadata), 'feature_id')",
        ),
        params: {},
        tags: {
          feature: "trace-conclusion",
          type: "query",
          kind: "find-concluded",
        },
      });
    });

    it("should return empty array when no traces found", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce([]);

      const result = await service.findConcludedTraces();

      expect(result).toEqual([]);
    });

    it("should handle query errors gracefully", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockRejectedValueOnce(
        new Error("ClickHouse error"),
      );

      const result = await service.findConcludedTraces();

      expect(result).toEqual([]);
      expect(clickhouse.logger.error).toHaveBeenCalledWith(
        "Failed to query concluded traces:",
        expect.any(Error),
      );
    });

    it("should query for traces with 60 second threshold", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce([]);

      await service.findConcludedTraces();

      const query = vi.mocked(clickhouse.queryClickhouse).mock.calls[0][0]
        .query;
      expect(query).toContain("INTERVAL 60 SECOND");
    });

    it("should limit results to 1000 traces", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce([]);

      await service.findConcludedTraces();

      const query = vi.mocked(clickhouse.queryClickhouse).mock.calls[0][0]
        .query;
      expect(query).toContain("LIMIT 1000");
    });
  });

  describe("processConcludedTraces", () => {
    it("should return 0 for empty trace list", async () => {
      const result = await service.processConcludedTraces([]);

      expect(result).toBe(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("should notify API for each trace", async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: {} });

      const result = await service.processConcludedTraces([
        "trace-1",
        "trace-2",
        "trace-3",
      ]);

      expect(result).toBe(3);
      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/features/analyze"),
        { trace_id: "trace-1" },
      );
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/features/analyze"),
        { trace_id: "trace-2" },
      );
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/features/analyze"),
        { trace_id: "trace-3" },
      );
    });

    it("should continue processing after individual failures", async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({ data: {} }) // trace-1 succeeds
        .mockRejectedValueOnce(new Error("API error")) // trace-2 fails
        .mockResolvedValueOnce({ data: {} }); // trace-3 succeeds

      const result = await service.processConcludedTraces([
        "trace-1",
        "trace-2",
        "trace-3",
      ]);

      expect(result).toBe(2); // 2 succeeded
      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(clickhouse.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to notify trace concluded for trace-2"),
        expect.any(Error),
      );
    });

    it("should log success and failure counts", async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(new Error("API error"));

      await service.processConcludedTraces(["trace-1", "trace-2"]);

      expect(clickhouse.logger.info).toHaveBeenCalledWith(
        "Processed concluded traces: 1 succeeded, 1 failed",
      );
    });
  });

  describe("checkAndProcessConcludedTraces", () => {
    it("should find and process traces end-to-end", async () => {
      const mockTraces = [{ trace_id: "trace-1" }, { trace_id: "trace-2" }];

      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce(mockTraces);
      vi.mocked(axios.post).mockResolvedValue({ data: {} });

      const result = await service.checkAndProcessConcludedTraces();

      expect(result).toBe(2);
      expect(clickhouse.queryClickhouse).toHaveBeenCalledOnce();
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it("should return 0 when no traces found", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockResolvedValueOnce([]);

      const result = await service.checkAndProcessConcludedTraces();

      expect(result).toBe(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(clickhouse.queryClickhouse).mockRejectedValueOnce(
        new Error("ClickHouse error"),
      );

      const result = await service.checkAndProcessConcludedTraces();

      expect(result).toBe(0);
      expect(clickhouse.logger.error).toHaveBeenCalledWith(
        "Failed to query concluded traces:",
        expect.any(Error),
      );
    });
  });
});
