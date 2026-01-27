import { PeriodicRunner } from "../utils/PeriodicRunner";
import { TraceConclusionService } from "./TraceConclusionService";
import { logger } from "@langfuse/shared/src/server";

/**
 * Periodic runner that checks for concluded traces every minute.
 *
 * A trace is considered concluded when all its observations
 * were last updated at least 60 seconds ago and it doesn't
 * have a 'feature_id' in its metadata.
 *
 * This runner:
 * - Runs every 60 seconds (1 minute)
 * - Finds concluded traces via ClickHouse query
 * - Notifies the API for each concluded trace
 * - Logs results and errors
 */
export class TraceConclusionRunner extends PeriodicRunner {
  private readonly service: TraceConclusionService;
  private readonly intervalMs: number;

  constructor(intervalMs = 60_000) {
    super();
    this.service = new TraceConclusionService();
    this.intervalMs = intervalMs;
  }

  protected get name(): string {
    return "TraceConclusionRunner";
  }

  protected get defaultIntervalMs(): number {
    return this.intervalMs;
  }

  protected async execute(): Promise<void> {
    logger.debug("Starting trace conclusion check");

    const processedCount = await this.service.checkAndProcessConcludedTraces();

    if (processedCount > 0) {
      logger.info(`Trace conclusion check: processed ${processedCount} traces`);
    } else {
      logger.debug("Trace conclusion check: no traces to process");
    }
  }
}
