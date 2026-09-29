declare namespace Express {
  interface Request {
    /** Trace ID stamped by the correlation middleware. Always present after that middleware runs. */
    correlationId: string;
  }
}
