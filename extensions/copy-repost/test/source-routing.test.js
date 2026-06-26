import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const sourceRoutingPath = path.resolve("extensions/copy-repost/src/source-routing.js");

async function loadSourceRouting() {
  const source = await readFile(sourceRoutingPath, "utf8");
  const sandbox = {
    window: {},
    URL
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(source, sandbox, { filename: sourceRoutingPath });

  return sandbox.CopyRepostSourceRouting;
}

function fromSandbox(value) {
  return JSON.parse(JSON.stringify(value));
}

test("source routing uses popup mappings only for popup sources and keeps helper config as fallback", async () => {
  const routing = await loadSourceRouting();
  const popupMappings = [
    {
      id: "popup-route-872226993557606440",
      enabled: true,
      sourceUrl: "https://discord.com/channels/850715868539519026/872226993557606440",
      destinationUrls: ["https://discord.com/channels/1508501048610914406/1519744142471725136"],
      prefix: "[copied-alert]"
    }
  ];
  const helperConfig = {
    enabled: true,
    mappings: [
      {
        id: "mikes-alerts-to-test",
        enabled: true,
        sourceChannelId: "872226993557606440",
        sourceUrl: "https://discord.com/channels/850715868539519026/872226993557606440",
        destinationUrls: ["https://discord.com/channels/1508501048610914406/1518453268169101402"]
      },
      {
        id: "test-to-echo",
        enabled: true,
        sourceChannelId: "1518453268169101402",
        sourceUrl: "https://discord.com/channels/1508501048610914406/1518453268169101402",
        destinationUrls: ["https://discord.com/channels/1508501048610914406/1519744142471725136"]
      }
    ]
  };

  const sourceConfig = routing.buildSourceConfig({
    helperConfig,
    runtimeMappings: popupMappings
  });

  const mikesSubmission = routing.selectSubmissionForPayload(
    {
      sourceUrl: "https://discord.com/channels/850715868539519026/872226993557606440",
      sourceChannelId: "872226993557606440",
      text: "mikes alert"
    },
    sourceConfig
  );
  const testSubmission = routing.selectSubmissionForPayload(
    {
      sourceUrl: "https://discord.com/channels/1508501048610914406/1518453268169101402",
      sourceChannelId: "1518453268169101402",
      text: "test alert"
    },
    sourceConfig
  );

  assert.equal(mikesSubmission.allowed, true);
  assert.equal(mikesSubmission.mode, "popup");
  assert.deepEqual(fromSandbox(mikesSubmission.body), {
    alert: {
      sourceUrl: "https://discord.com/channels/850715868539519026/872226993557606440",
      sourceChannelId: "872226993557606440",
      text: "mikes alert"
    },
    mappings: popupMappings
  });

  assert.equal(testSubmission.allowed, true);
  assert.equal(testSubmission.mode, "helper");
  assert.deepEqual(fromSandbox(testSubmission.body), {
    sourceUrl: "https://discord.com/channels/1508501048610914406/1518453268169101402",
    sourceChannelId: "1518453268169101402",
    text: "test alert"
  });
});

