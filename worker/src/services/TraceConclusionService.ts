import { logger } from "@langfuse/shared/src/server";
import { notifyTraceConcluded } from "../../../packages/shared/src/server/repositories/observations";
import { queryClickhouse } from "@langfuse/shared/src/server";

/**
 * Service for identifying and notifying concluded traces.
 *
 * A trace is considered concluded when:
 * 1. All its observations were last updated at least 60 seconds ago
 * 2. The trace metadata does not contain a 'feature_id' attribute
 *
 * This service runs periodically (via cron) to check for concluded traces
 * and notify the API for feature analysis.
 */
export class TraceConclusionService {
  private readonly INACTIVITY_THRESHOLD_SECONDS = 60;

  /**
   * Find all traces that are concluded but haven't been processed yet.
   *
   * A trace is concluded when:
   * - The most recent observation update was at least 60 seconds ago
   * - The trace metadata does not have a 'feature_id' key
   *
   * @returns Array of trace IDs that need to be processed
   */
  async findConcludedTraces(): Promise<string[]> {
    const query = `
      WITH trace_latest_updates AS (
        SELECT
          trace_id,
          max(updated_at) as last_updated
        FROM observations FINAL
        WHERE updated_at < now() - INTERVAL ${this.INACTIVITY_THRESHOLD_SECONDS} SECOND
        GROUP BY trace_id
      )
      SELECT DISTINCT
        t.id as trace_id
      FROM traces FINAL t
      INNER JOIN trace_latest_updates tlu ON t.id = tlu.trace_id
      WHERE NOT has(mapKeys(t.metadata), 'feature_id')
      AND t.timestamp < now() - INTERVAL ${this.INACTIVITY_THRESHOLD_SECONDS} SECOND
      LIMIT 1000
    `;

    try {
      const results = await queryClickhouse<{ trace_id: string }>({
        query,
        params: {},
        tags: {
          feature: "trace-conclusion",
          type: "query",
          kind: "find-concluded",
        },
      });

      const traceIds = results.map((r) => r.trace_id);

      if (traceIds.length > 0) {
        logger.info(
          `Found ${traceIds.length} concluded traces ready for processing`,
        );
      }

      return traceIds;
    } catch (error) {
      logger.error("Failed to query concluded traces:", error);
      return [];
    }
  }

  /**
   * Process concluded traces by notifying the API for each one.
   *
   * Sends notifications sequentially to avoid overwhelming the API.
   * Continues processing even if individual notifications fail.
   *
   * @param traceIds - Array of trace IDs to process
   * @returns Count of successfully processed traces
   */
  async processConcludedTraces(traceIds: string[]): Promise<number> {
    if (traceIds.length === 0) {
      return 0;
    }

    logger.info(`Processing ${traceIds.length} concluded traces`);

    let successCount = 0;
    let failureCount = 0;

    for (const traceId of traceIds) {
      try {
        await notifyTraceConcluded(traceId);
        successCount++;

        logger.debug(`Successfully notified trace concluded: ${traceId}`);
      } catch (error) {
        failureCount++;
        logger.error(`Failed to notify trace concluded for ${traceId}:`, error);
        // Continue processing other traces even if one fails
      }
    }

    logger.info(
      `Processed concluded traces: ${successCount} succeeded, ${failureCount} failed`,
    );

    return successCount;
  }

  /**
   * Main entry point: Find and process all concluded traces.
   *
   * This method should be called periodically (e.g., every minute via cron).
   *
   * @returns Count of successfully processed traces
   */
  async checkAndProcessConcludedTraces(): Promise<number> {
    try {
      const traceIds = await this.findConcludedTraces();
      return await this.processConcludedTraces(traceIds);
    } catch (error) {
      logger.error("Error in trace conclusion check:", error);
      return 0;
    }
  }
}
