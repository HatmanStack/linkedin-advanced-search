# LinkedIn Interaction Queue

This project keeps a long-lived Puppeteer browser for the `linkedin-interactions` endpoint to minimize logins. Concurrent requests previously contended for the same single `Page`, causing sessions to cannibalize each other. We added a simple in-memory queue to serialize interaction jobs safely while preserving the long-lived session.

## Approach
- A new utility `puppeteer-backend/utils/interactionQueue.js` implements a FIFO queue with configurable concurrency (default 1 via `config.linkedinInteractions.maxConcurrentInteractions`).
- The `linkedin-interactions` controller enqueues units of work instead of running them immediately. This ensures only one job manipulates the shared Puppeteer `Page` at a time.
- The queue tracks per-job status and logs start/finish/error for observability.
- We kept the long-lived browser/session behavior intact to minimize logins. The first job initializes/logs in if needed; subsequent jobs reuse the session.

## Files changed
- `puppeteer-backend/utils/interactionQueue.js`: New in-memory queue. Exports a singleton `linkedInInteractionQueue`.
- `puppeteer-backend/controllers/linkedinInteractionController.js`: Wraps `sendMessage`, `addConnection`, and `createPost` operations in `linkedInInteractionQueue.enqueue(...)`.
- `config.linkedinInteractions.maxConcurrentInteractions` can raise concurrency later (requires page-per-job refactor for true parallelism).

## Behavior
- Multiple incoming requests are accepted. Jobs enter the queue and run in order.
- While a job is running, additional requests wait in the queue; no session/page overlap occurs.
- Browser remains open between jobs; if session isn’t active, the first job will reinitialize and log in.

## Future Enhancements
- Add `GET /jobs/:id` and SSE for progress; return `202 Accepted` with job IDs on enqueue.
- Migrate to page-per-job (reuse same browser, `browser.newPage()` per job) for safe parallelism; thread explicit `Page` into services.
- Optionally replace in-memory queue with Redis-backed queue (BullMQ) for durability and cross-process scaling.

## Notes
- Current change focuses on preventing cannibalization with minimal code churn and keeping login frequency low.
- If you set concurrency > 1 without page-per-job refactor, jobs will still serialize effectively due to the shared single `Page` in `PuppeteerService`.
