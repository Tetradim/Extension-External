import { createServer as createHttpServer } from "node:http";

export function createServer({ config, store }) {
  return createHttpServer(async (request, response) => {
    try {
      await route({ request, response, config, store });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

async function route({ request, response, config, store }) {
  const url = new URL(request.url, "http://127.0.0.1");

  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true, enabled: config.enabled });
  }

  if (request.method === "GET" && url.pathname === "/config") {
    return sendJson(response, 200, sanitizeConfig(config));
  }

  if (request.method === "POST" && url.pathname === "/events") {
    const payload = await readJson(request);
    const result = await store.enqueueAlert(config, payload);
    return sendJson(response, 202, result);
  }

  if (request.method === "GET" && url.pathname === "/jobs/next") {
    const clientId = url.searchParams.get("clientId") ?? "";
    const job = await store.claimNextJob(clientId);
    return sendJson(response, 200, job ?? { job: null });
  }

  const resultMatch = url.pathname.match(/^\/jobs\/([^/]+)\/result$/);
  if (request.method === "POST" && resultMatch) {
    const body = await readJson(request);
    const result = await store.recordJobResult({
      jobId: decodeURIComponent(resultMatch[1]),
      status: body.status,
      reason: body.reason ?? "",
      degradation: Array.isArray(body.degradation) ? body.degradation : [],
      clientId: body.clientId,
      retry: config.retry
    });
    return sendJson(response, 200, result);
  }

  if (request.method === "GET" && url.pathname === "/status") {
    const snapshot = await store.snapshot();
    return sendJson(response, 200, summarize(snapshot));
  }

  return sendJson(response, 404, { error: "Not found" });
}

function sanitizeConfig(config) {
  return {
    enabled: config.enabled,
    retry: config.retry,
    sendPacingMs: config.sendPacingMs,
    mappings: config.mappings
  };
}

function summarize(snapshot) {
  const counts = {
    queued: 0,
    in_progress: 0,
    retry_wait: 0,
    sent: 0,
    failed: 0,
    skipped_duplicate: snapshot.events.filter((event) => event.type === "skipped_duplicate").length
  };

  for (const job of snapshot.jobs) {
    if (Object.hasOwn(counts, job.status)) {
      counts[job.status] += 1;
    }
  }

  return {
    counts,
    recentEvents: snapshot.events.slice(-25)
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json"
  });

  if (statusCode === 204) {
    response.end();
    return;
  }

  response.end(JSON.stringify(body));
}
