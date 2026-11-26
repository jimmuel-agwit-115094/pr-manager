import express, { Router } from 'express';
import type { CommentSide, NewReviewComment } from '@pr-manager/contracts';
import { AppError } from '../../errors';
import type { ReviewThreadService } from '../../services/review-thread.service';
import { parsePrNumber } from '../params';

type PrParams = { owner: string; repo: string; number: string };

/** Mounted at /api/repos/:owner/:repo/pulls/:number/threads */
export function threadsRoutes(threads: ReviewThreadService): Router {
  const router = Router({ mergeParams: true });
  router.use(express.json({ limit: '256kb' }));

  router.get('/', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await threads.list(owner, repo, parsePrNumber(number)));
  });

  // POST { path, line, side, body } → starts a thread
  router.post('/', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await threads.create(owner, repo, parsePrNumber(number), parseNewComment(req.body)));
  });

  // POST /:commentId/replies { body } → replies to the thread started by that comment
  router.post('/:commentId/replies', async (req, res) => {
    const { owner, repo, number, commentId } = req.params as PrParams & { commentId: string };
    const id = Number(commentId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, `Invalid comment id "${commentId}".`);
    }
    res.json(await threads.reply(owner, repo, parsePrNumber(number), id, parseBody(req.body)));
  });

  // PUT /:threadId/status { resolved } → resolves (true) or reactivates (false) the thread
  router.put('/:threadId/status', async (req, res) => {
    const { owner, repo, number, threadId } = req.params as PrParams & { threadId: string };
    if (!THREAD_ID.test(threadId)) {
      throw new AppError(400, `Invalid thread id "${threadId}".`);
    }
    const resolved = (req.body as { resolved?: unknown } | undefined)?.resolved;
    if (typeof resolved !== 'boolean') {
      throw new AppError(400, 'resolved must be true or false.');
    }
    res.json(await threads.setResolved(owner, repo, parsePrNumber(number), threadId, resolved));
  });

  return router;
}

/** GitHub GraphQL node ids, e.g. PRRT_kwDOAbc123. */
const THREAD_ID = /^[A-Za-z0-9_=-]{1,128}$/;

function parseBody(raw: unknown): string {
  const body = (raw as { body?: unknown } | undefined)?.body;
  if (typeof body !== 'string') {
    throw new AppError(400, 'Missing comment body.');
  }
  return body;
}

function parseNewComment(raw: unknown): NewReviewComment {
  const input = (raw ?? {}) as Partial<Record<keyof NewReviewComment, unknown>>;
  if (typeof input.path !== 'string' || !input.path) {
    throw new AppError(400, 'Missing file path.');
  }
  if (typeof input.line !== 'number' || !Number.isInteger(input.line) || input.line <= 0) {
    throw new AppError(400, 'Invalid line number.');
  }
  if (input.side !== 'LEFT' && input.side !== 'RIGHT') {
    throw new AppError(400, 'Side must be LEFT or RIGHT.');
  }
  return { path: input.path, line: input.line, side: input.side as CommentSide, body: parseBody(raw) };
}
