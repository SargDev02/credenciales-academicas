import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";

// Node does not await request listeners. Keep fixture failures observable as HTTP
// failures instead of unhandled rejections or a request that never finishes.
export function guardFixtureRequest(
  handler: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<unknown>,
): RequestListener {
  return (request, response) => {
    void handler(request, response).catch(() => {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
      }
      if (!response.writableEnded)
        response.end(JSON.stringify({ error: "LOCAL_FIXTURE_FAILED" }));
    });
  };
}
