#### Advanced API Usage

# Batch API

The Batch API lets you process large volumes of requests asynchronously with reduced pricing and higher rate limits. For pricing details, see [Batch API Pricing](/developers/pricing#batch-api-pricing).

## What is the Batch API?

When you make a standard API call to Grok, you send a request and wait for an immediate response. This approach is perfect for interactive applications like chatbots, real-time assistants, or any use case where users are waiting for a response.

The Batch API takes a different approach. Instead of processing requests immediately, you submit them to a queue where they're processed in the background. You don't get an instant response—instead, you check back later to retrieve your results.

**Key differences from real-time API requests:**

| | Real-time API | Batch API |
|---|---|---|
| **Response time** | Immediate (seconds) | Typically within 24 hours\* |
| **Cost** | Standard pricing | Reduced pricing ([see details](/developers/pricing#batch-api-pricing)) |
| **Rate limits** | Per-minute limits apply | Requests don't count towards rate limits |
| **Use case** | Interactive, real-time | Background processing, bulk jobs |

\* **Processing time:** Most batch requests complete within **24 hours**, though processing time may vary depending on system load and batch size. Completion time is best effort and not guaranteed.

> [!NOTE]
>
> You can also create, monitor, and manage batches through the [xAI Console](https://console.x.ai/team/default/batches). The Console provides a visual interface for tracking batch progress and viewing results.

## When to use the Batch API

The Batch API is ideal when you don't need immediate results and want to **reduce your API costs**:

* **Running evaluations and benchmarks** - Test model performance across thousands of prompts
* **Processing large datasets** - Analyze customer feedback, classify support tickets, extract entities
* **Content moderation at scale** - Review backlogs of user-generated content
* **Document summarization** - Process reports, research papers, or legal documents in bulk
* **Data enrichment pipelines** - Add AI-generated insights to database records
* **Scheduled overnight jobs** - Generate daily reports or prepare data for dashboards

## How it works

The Batch API workflow consists of four main steps:

1. **Create a batch** - A batch is a container that groups related requests together
2. **Add requests** - Submit your inference requests to the batch queue
3. **Monitor progress** - Poll the batch status to track completion
4. **Retrieve results** - Fetch responses for all processed requests

Let's walk through each step.

## Step 1: Create a batch

A batch acts as a container for your requests. Think of it as a folder that groups related work together—you might create separate batches for different datasets, experiments, or job types.

When you create a batch, you receive a `batch_id` that you'll use to add requests and retrieve results.

```bash
curl -X POST https://api.x.ai/v1/batches \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -d '{
    "name": "customer_feedback_analysis"
  }'
```

```pythonXAI
from xai_sdk import Client

client = Client()

# Create a batch with a descriptive name
batch = client.batch.create(batch_name="customer_feedback_analysis")
print(f"Created batch: {batch.batch_id}")

# Store the batch_id for later use
batch_id = batch.batch_id
```

```javascriptWithoutSDK
// Create a batch with a descriptive name
const response = await fetch("https://api.x.ai/v1/batches", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.XAI_API_KEY}\`,
  },
  body: JSON.stringify({ name: "customer_feedback_analysis" }),
});
const batch = await response.json();
console.log(\`Created batch: \${batch.batch_id}\`);

// Store the batch_id for later use
const batchId = batch.batch_id;
```

## Step 2: Add requests to the batch

With your batch created, you can now add requests to it. Each request will be processed asynchronously.

**With the xAI SDK, adding batch requests is simple:** use `chat.create()` for text, `image.prepare()` for images, `video.prepare()` for videos, or `video.prepare_extension()` for video extensions, then pass them as a list. You can also upload a [JSONL file](#jsonl-file-upload) if you prefer.

**Important:** Assign a unique `batch_request_id` to each request. This ID lets you match results back to their original requests, which becomes important when you're processing hundreds or thousands of items. If you don't provide an ID, we generate a UUID for you. Using your own IDs is useful for idempotency (ensuring a request is only processed once) and for linking batch requests to records in your own system.

```pythonXAI
from xai_sdk import Client
from xai_sdk.chat import system, user
from xai_sdk.tools import web_search, x_search, mcp

client = Client()

batch_requests = []

# Chat completion with tools
chat = client.chat.create(
    model="grok-4.3",
    batch_request_id="chat_001",
    tools=[web_search(), x_search()],
)
chat.append(system("Analyze market sentiment from recent news and posts."))
chat.append(user("What is the current sentiment around TSLA stock?"))
batch_requests.append(chat)

# Image generation
image_req = client.image.prepare(
    prompt="A sleek modern laptop on a minimalist desk",
    model="grok-imagine-image-quality",
    batch_request_id="img_001",
)
batch_requests.append(image_req)

# Image edit
image_edit_req = client.image.prepare(
    prompt="Add a rainbow in the background",
    model="grok-imagine-image-quality",
    image_url="https://picsum.photos/800",
    batch_request_id="img_edit_001",
)
batch_requests.append(image_edit_req)

# Video generation
video_req = client.video.prepare(
    prompt="A product rotating on a turntable with dramatic lighting",
    model="grok-imagine-video",
    batch_request_id="vid_001",
)
batch_requests.append(video_req)

# Video edit
video_edit_req = client.video.prepare(
    prompt="Make it slow motion",
    model="grok-imagine-video",
    video_url="https://lorem.video/cat_360p_3s",
    batch_request_id="vid_edit_001",
)
batch_requests.append(video_edit_req)

# Video extension
video_ext_req = client.video.prepare_extension(
    prompt="The camera slowly pans to reveal a sunset behind the mountains",
    model="grok-imagine-video",
    video_url="https://lorem.video/cat_360p_3s",
    duration=6,
    batch_request_id="vid_ext_001",
)
batch_requests.append(video_ext_req)

# Remote MCP
mcp_chat = client.chat.create(
    model="grok-4.3",
    batch_request_id="mcp_001",
    tools=[mcp(server_url="https://mcp.deepwiki.com/mcp")],
)
mcp_chat.append(user("What does the xai-sdk-python repo do?"))
batch_requests.append(mcp_chat)

# Add all requests to the batch
client.batch.add(batch_id=batch.batch_id, batch_requests=batch_requests)
print(f"Added {len(batch_requests)} requests to batch")
```

```bash
curl -X POST https://api.x.ai/v1/batches/{batch_id}/requests \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -d '{
    "batch_requests": [
      {
        "batch_request_id": "feedback_001",
        "batch_request": {
          "responses": {
            "input": [
              {"role": "system", "content": "Classify the sentiment as positive, negative, or neutral."},
              {"role": "user", "content": "The product exceeded my expectations!"}
            ],
            "model": "grok-4.3"
          }
        }
      },
      {
        "batch_request_id": "feedback_002",
        "batch_request": {
          "responses": {
            "input": [
              {"role": "system", "content": "Classify the sentiment as positive, negative, or neutral."},
              {"role": "user", "content": "Shipping took way too long."}
            ],
            "model": "grok-4.3"
          }
        }
      }
    ]
  }'
```

```javascriptWithoutSDK
const batchRequests = [];

// Chat completion with tools (uses "responses" endpoint for server-side tool support)
batchRequests.push({
  batch_request_id: "chat_001",
  batch_request: {
    responses: {
      model: "grok-4.3",
      tools: [{ type: "web_search" }, { type: "x_search" }],
      input: [
        { role: "system", content: "Analyze market sentiment from recent news and posts." },
        { role: "user", content: "What is the current sentiment around TSLA stock?" },
      ],
    },
  },
});

// Image generation
batchRequests.push({
  batch_request_id: "img_001",
  batch_request: {
    image_generation: {
      prompt: "A sleek modern laptop on a minimalist desk",
      model: "grok-imagine-image-quality",
    },
  },
});

// Image edit
batchRequests.push({
  batch_request_id: "img_edit_001",
  batch_request: {
    image_edit: {
      prompt: "Add a rainbow in the background",
      model: "grok-imagine-image-quality",
      image: { url: "https://picsum.photos/800", type: "image_url" },
    },
  },
});

// Video generation
batchRequests.push({
  batch_request_id: "vid_001",
  batch_request: {
    video_generation: {
      prompt: "A product rotating on a turntable with dramatic lighting",
      model: "grok-imagine-video",
    },
  },
});

// Video edit
batchRequests.push({
  batch_request_id: "vid_edit_001",
  batch_request: {
    video_generation: {
      prompt: "Make it slow motion",
      model: "grok-imagine-video",
      video: { url: "https://lorem.video/cat_360p_3s" },
    },
  },
});

// Video extension
batchRequests.push({
  batch_request_id: "vid_ext_001",
  batch_request: {
    video_extension: {
      prompt: "The camera slowly pans to reveal a sunset behind the mountains",
      model: "grok-imagine-video",
      video: { url: "https://lorem.video/cat_360p_3s" },
      duration: 6,
    },
  },
});

// Remote MCP
batchRequests.push({
  batch_request_id: "mcp_001",
  batch_request: {
    responses: {
      model: "grok-4.3",
      tools: [{ type: "mcp", server_label: "deepwiki", server_url: "https://mcp.deepwiki.com/mcp" }],
      input: [{ role: "user", content: "What does the xai-sdk-python repo do?" }],
    },
  },
});

// Add all requests to the batch
const response = await fetch(\`https://api.x.ai/v1/batches/\${batchId}/requests\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.XAI_API_KEY}\`,
  },
  body: JSON.stringify({ batch_requests: batchRequests }),
});
if (!response.ok) throw new Error(\`Failed to add requests: \${await response.text()}\`);
console.log(\`Added \${batchRequests.length} requests to batch\`);
```

## Step 3: Monitor batch progress

After adding requests, they begin processing in the background. Since batch processing is asynchronous, you need to poll the batch status to know when results are ready.

The batch state includes counters for pending, successful, and failed requests. Poll periodically until `num_pending` reaches zero, which indicates all requests have been processed (either successfully or with errors).

```bash
# Check batch status
curl https://api.x.ai/v1/batches/{batch_id} \\
  -H "Authorization: Bearer $XAI_API_KEY"

# Response includes state with request counts:
# {
#   "state": {
#     "num_requests": 100,
#     "num_pending": 25,
#     "num_success": 70,
#     "num_error": 5
#   }
# }
```

```pythonXAI
import time
from xai_sdk import Client

client = Client()

# Poll until all requests are processed
print("Waiting for batch to complete...")
while True:
    batch = client.batch.get(batch_id=batch.batch_id)
    
    pending = batch.state.num_pending
    completed = batch.state.num_success + batch.state.num_error
    total = batch.state.num_requests
    
    print(f"Progress: {completed}/{total} complete, {pending} pending")
    
    if pending == 0:
        print("Batch processing complete!")
        break
    
    # Wait before polling again (avoid hammering the API)
    time.sleep(5)
```

```javascriptWithoutSDK
// Poll until all requests are processed
console.log("Waiting for batch to complete...");
const interval = setInterval(async () => {
  const response = await fetch(
    \`https://api.x.ai/v1/batches/\${batchId}\`,
    { headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` } }
  );
  const batch = await response.json();

  const { num_pending, num_success, num_error, num_requests } = batch.state;
  const completed = num_success + num_error;
  console.log(\`Progress: \${completed}/\${num_requests} complete, \${num_pending} pending\`);

  if (num_requests > 0 && num_pending === 0) {
    clearInterval(interval);
    console.log("Batch processing complete!");
  }
  // Wait before polling again (avoid hammering the API)
}, 5000);
```

### Understanding batch states

The Batch API tracks state at two levels: the **batch level** and the **individual request level**.

**Batch-level state** shows aggregate progress across all requests in a given batch,
accessible through the `batch.state` object returned by the `client.batch.get()` method:

| Counter | Description |
|---|---|
| `num_requests` | Total number of requests added to the batch |
| `num_pending` | Requests waiting to be processed |
| `num_success` | Requests that completed successfully |
| `num_error` | Requests that failed with an error |
| `num_cancelled` | Requests that were cancelled |

When `num_pending` reaches zero, all requests have been processed (either successfully, with errors, or cancelled).

**Individual request states** describe where each request is in its lifecycle, accessible through the `batch_request_metadata` object returned by the `client.batch.list_batch_requests()` [method](#check-individual-request-status):

| State | Description |
|---|---|
| `pending` | Request is queued and waiting to be processed |
| `succeeded` | Request completed successfully, result is available |
| `failed` | Request encountered an error during processing |
| `cancelled` | Request was cancelled (e.g., when the batch was cancelled before this request was processed) |

**Batch lifecycle:** A batch can also be cancelled or expire. [If you cancel a batch](#cancel-a-batch), pending requests won't be processed, but already-completed results remain available. Batches have an expiration time after which results are no longer accessible—check the `expires_at` field when retrieving batch details.

## Step 4: Retrieve results

You can retrieve results at any time, even before the entire batch completes. Results are available as soon as individual requests finish processing, so you can start consuming completed results while other requests are still in progress.

Each result is linked to its original request via the `batch_request_id` you assigned earlier. For chat completions, use `result.response` which has the familiar fields: `.content`, `.usage`, `.finish_reason`, and more. For image requests, use `result.image_response` which provides `.url`, `.base64`, `.usage`, and `.model`. For video requests, use `result.video_response` which provides `.url`, `.duration`, `.usage`, and `.model`. These are the same response types returned by the regular `client.image.sample()` and `client.video.generate()` methods.

The SDK provides convenient `.succeeded` and `.failed` properties to separate successful responses from errors.

**Pagination:** Results are returned in pages. Use the `limit` parameter to control page size and `pagination_token` to fetch subsequent pages. When `pagination_token` is `None`, you've reached the end.

```pythonXAI
from xai_sdk import Client

client = Client()

# Paginate through all results
all_succeeded = []
all_failed = []
pagination_token = None

while True:
    # Fetch a page of results (limit controls page size)
    page = client.batch.list_batch_results(
        batch_id=batch.batch_id,
        limit=100,
        pagination_token=pagination_token,
    )
    
    # Collect results from this page
    all_succeeded.extend(page.succeeded)
    all_failed.extend(page.failed)
    
    # Check if there are more pages
    if page.pagination_token is None:
        break
    pagination_token = page.pagination_token

# Process results - handle different response types
print(f"Successfully processed: {len(all_succeeded)} requests")
for result in all_succeeded:
    rid = result.batch_request_id
    resp = result.proto.response

    if resp.HasField("completion_response"):
        # Chat completion response
        print(f"[{rid}] {result.response.content}")
        print(f"  Tokens used: {result.response.usage.total_tokens}")
    elif resp.HasField("image_response"):
        # Image generation response
        print(f"[{rid}] Image URL: {result.image_response.url}")
    elif resp.HasField("video_response"):
        # Video generation response
        print(f"[{rid}] Video URL: {result.video_response.url}")

if all_failed:
    print(f"\\nFailed: {len(all_failed)} requests")
    for result in all_failed:
        print(f"[{result.batch_request_id}] Error: {result.error_message}")
```

```bash
# Fetch first page
curl "https://api.x.ai/v1/batches/{batch_id}/results?limit=100" \\
  -H "Authorization: Bearer $XAI_API_KEY"

# Use pagination_token from response to fetch next page
curl "https://api.x.ai/v1/batches/{batch_id}/results?limit=100&pagination_token={token}" \\
  -H "Authorization: Bearer $XAI_API_KEY"
```

```javascriptWithoutSDK
// Paginate through all results
const allSucceeded = [];
const allFailed = [];
let paginationToken = undefined;

while (true) {
  // Fetch a page of results (limit controls page size)
  const url = new URL(\`https://api.x.ai/v1/batches/\${batchId}/results\`);
  url.searchParams.set("limit", "100");
  if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

  const res = await fetch(url, {
    headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` },
  });
  const page = await res.json();

  // Collect results from this page
  for (const result of page.results) {
    const response = result.batch_result?.response;
    if (response?.chat_get_completion || response?.image_generation || response?.video_generation) {
      allSucceeded.push(result);
    } else {
      allFailed.push(result);
    }
  }

  // Check if there are more pages
  if (!page.pagination_token) break;
  paginationToken = page.pagination_token;
}

// Process all results
console.log(\`Successfully processed: \${allSucceeded.length} requests\`);
for (const result of allSucceeded) {
  const response = result.batch_result.response;
  const content = response.chat_get_completion?.choices[0].message.content
    ?? response.image_generation?.data[0].url
    ?? response.video_generation?.video.url;
  const tokens = response.chat_get_completion?.usage?.total_tokens;
  // Access the full response object
  console.log(\`[\${result.batch_request_id}] \${content}\`);
  if (tokens != null) console.log(\`  Tokens used: \${tokens}\`);
}

if (allFailed.length > 0) {
  console.log(\`\\nFailed: \${allFailed.length} requests\`);
  for (const result of allFailed) {
    console.log(\`[\${result.batch_request_id}] Error: \${result.error_message}\`);
  }
}
```

## Additional operations

Beyond the core workflow, the Batch API provides additional operations for managing your batches.

### Cancel a batch

You can cancel a batch before all requests complete. Already-processed requests remain available in the results, but pending requests will not be processed. You cannot add more requests to a cancelled batch.

```bash
curl -X POST https://api.x.ai/v1/batches/{batch_id}:cancel \\
  -H "Authorization: Bearer $XAI_API_KEY"
```

```pythonXAI
from xai_sdk import Client

client = Client()

# Cancel processing
cancelled_batch = client.batch.cancel(batch_id=batch.batch_id)
print(f"Cancelled batch: {cancelled_batch.batch_id}")
print(f"Completed before cancellation: {cancelled_batch.state.num_success} requests")
```

```javascriptWithoutSDK
// Cancel processing
const response = await fetch(
  \`https://api.x.ai/v1/batches/\${batchId}:cancel\`,
  { method: "POST", headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` } }
);
const cancelledBatch = await response.json();
console.log(\`Cancelled batch: \${cancelledBatch.batch_id}\`);
console.log(\`Completed before cancellation: \${cancelledBatch.state.num_success} requests\`);
```

### List all batches

View all batches belonging to your team. Batches are retained until they expire (check the `expires_at` field). This endpoint supports the same `limit` and `pagination_token` parameters for paginating through large lists.

```bash
curl "https://api.x.ai/v1/batches?limit=20" \\
  -H "Authorization: Bearer $XAI_API_KEY"
```

```pythonXAI
from xai_sdk import Client

client = Client()

# List recent batches
response = client.batch.list(limit=20)

for batch in response.batches:
    status = "complete" if batch.state.num_pending == 0 else "processing"
    print(f"{batch.name} ({batch.batch_id}): {status}")
```

```javascriptWithoutSDK
// List recent batches
const response = await fetch(
  "https://api.x.ai/v1/batches?limit=20",
  { headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` } }
);
const data = await response.json();

for (const batch of data.batches) {
  const status = batch.state.num_pending === 0 ? "complete" : "processing";
  console.log(\`\${batch.name} (\${batch.batch_id}): \${status}\`);
}
```

### Check individual request status

For detailed tracking, you can inspect the metadata for each request in a batch. This shows the status, timing, and other details for individual requests. This endpoint supports the same `limit` and `pagination_token` parameters for paginating through large batches.

```bash
curl "https://api.x.ai/v1/batches/{batch_id}/requests?limit=50" \\
  -H "Authorization: Bearer $XAI_API_KEY"
```

```pythonXAI
from xai_sdk import Client

client = Client()

# Get metadata for individual requests
metadata = client.batch.list_batch_requests(batch_id=batch.batch_id)

for request in metadata.batch_request_metadata:
    print(f"Request {request.batch_request_id}: {request.state}")
```

```javascriptWithoutSDK
// Get metadata for individual requests
const response = await fetch(
  \`https://api.x.ai/v1/batches/\${batchId}/requests?limit=50\`,
  { headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` } }
);
const data = await response.json();

for (const req of data.batch_request_metadata) {
  console.log(\`Request \${req.batch_request_id}: \${req.state}\`);
}
```

### Track costs

Each batch tracks the total processing cost. Access the cost breakdown after processing to understand your spending. For pricing details, see [Batch API Pricing on the Pricing page](/developers/pricing#batch-api-pricing).

```bash
# Get batch with cost information
curl -s "https://api.x.ai/v1/batches/{batch_id}/results?limit=100" \\
  -H "Authorization: Bearer $XAI_API_KEY"

# Cost per result can be found on response.results[].batch_result.response.chat_get_completion.usage.cost_in_usd_ticks
# Cost is returned in ticks (1e-10 USD) for precision
```

```pythonXAI
from xai_sdk import Client

client = Client()

# Get batch with cost information
batch = client.batch.get(batch_id=batch.batch_id)

# Cost is returned in ticks (1e-10 USD) for precision
total_cost_usd = batch.cost_breakdown.total_cost_usd_ticks / 1e10
print("Total cost: $%.4f" % total_cost_usd)
```

```javascriptWithoutSDK
// Get batch with cost information
const response = await fetch(
  \`https://api.x.ai/v1/batches/\${batchId}/results?limit=100\`,
  { headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` } }
);
const data = await response.json();

// Cost is returned in ticks (1e-10 USD) for precision
let totalTicks = 0;
for (const r of data.results) {
  totalTicks += r.batch_result?.response?.chat_get_completion?.usage?.cost_in_usd_ticks ?? 0;
}
console.log(\`Total cost: $\${(totalTicks / 1e10).toFixed(4)}\`);
```

## Complete example

This end-to-end example demonstrates a realistic batch workflow: analyzing customer feedback at scale. It creates a batch, submits feedback items for sentiment analysis, waits for processing, and outputs the results. For simplicity, this example doesn't paginate results—see [Step 4](#step-4-retrieve-results) for pagination when processing larger batches.

```pythonXAI
import time
from xai_sdk import Client
from xai_sdk.chat import system, user

client = Client()

# Sample dataset: customer feedback to analyze
feedback_data = [
    {"id": "fb_001", "text": "Absolutely love this product! Best purchase ever."},
    {"id": "fb_002", "text": "Delivery was late and the packaging was damaged."},
    {"id": "fb_003", "text": "Works fine, nothing special to report."},
    {"id": "fb_004", "text": "Customer support was incredibly helpful!"},
    {"id": "fb_005", "text": "The app keeps crashing on my phone."},
]

# Step 1: Create a batch
print("Creating batch...")
batch = client.batch.create(batch_name="feedback_sentiment_analysis")
print(f"Batch created: {batch.batch_id}")

# Step 2: Build and add requests
print("\\nAdding requests...")
batch_requests = []
for item in feedback_data:
    chat = client.chat.create(
        model="grok-4.3",
        batch_request_id=item["id"],
    )
    chat.append(system(
        "Analyze the sentiment of the customer feedback. "
        "Respond with exactly one word: positive, negative, or neutral."
    ))
    chat.append(user(item["text"]))
    batch_requests.append(chat)

client.batch.add(batch_id=batch.batch_id, batch_requests=batch_requests)
print(f"Added {len(batch_requests)} requests")

# Step 3: Wait for completion
print("\\nProcessing...")
while True:
    batch = client.batch.get(batch_id=batch.batch_id)
    pending = batch.state.num_pending
    completed = batch.state.num_success + batch.state.num_error
    
    print(f"  {completed}/{batch.state.num_requests} complete")
    
    if pending == 0:
        break
    time.sleep(2)

# Step 4: Retrieve and display results
print("\\n--- Results ---")
results = client.batch.list_batch_results(batch_id=batch.batch_id)

# Create a lookup for original feedback text
feedback_lookup = {item["id"]: item["text"] for item in feedback_data}

for result in results.succeeded:
    original_text = feedback_lookup.get(result.batch_request_id, "")
    sentiment = result.response.content.strip().lower()
    print(f"[{sentiment.upper()}] {original_text[:50]}...")

# Report any failures
if results.failed:
    print("\\n--- Errors ---")
    for result in results.failed:
        print(f"[{result.batch_request_id}] {result.error_message}")

# Display cost
cost_usd = batch.cost_breakdown.total_cost_usd_ticks / 1e10
print("\\nTotal cost: $%.4f" % cost_usd)
```

```javascriptWithoutSDK
const BASE_URL = "https://api.x.ai/v1";
const headers = { "Content-Type": "application/json", Authorization: \`Bearer \${process.env.XAI_API_KEY}\` };

// Sample dataset: customer feedback to analyze
const feedbackData = [
  { id: "fb_001", text: "Absolutely love this product! Best purchase ever." },
  { id: "fb_002", text: "Delivery was late and the packaging was damaged." },
  { id: "fb_003", text: "Works fine, nothing special to report." },
  { id: "fb_004", text: "Customer support was incredibly helpful!" },
  { id: "fb_005", text: "The app keeps crashing on my phone." },
];

// Step 1: Create a batch
console.log("Creating batch...");
const batchRes = await fetch(\`\${BASE_URL}/batches\`, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: "feedback_sentiment_analysis" }),
});
const batch = await batchRes.json();
const batchId = batch.batch_id;
console.log(\`Batch created: \${batchId}\`);

// Step 2: Build and add requests
console.log("\\nAdding requests...");
const response = await fetch(\`\${BASE_URL}/batches/\${batchId}/requests\`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    batch_requests: feedbackData.map((item) => ({
      batch_request_id: item.id,
      batch_request: {
        chat_get_completion: {
          model: "grok-4.3",
          messages: [
            {
              role: "system",
              content: "Analyze the sentiment of the customer feedback. Respond with exactly one word: positive, negative, or neutral.",
            },
            { role: "user", content: item.text },
          ],
        },
      },
    })),
  }),
});
if (!response.ok) throw new Error(\`Failed to add requests: \${await response.text()}\`);
console.log(\`Added \${feedbackData.length} requests\`);

// Step 3: Wait for completion
console.log("\\nProcessing...");
const interval = setInterval(async () => {
  const statusRes = await fetch(\`\${BASE_URL}/batches/\${batchId}\`, { headers });
  const status = await statusRes.json();
  const { num_pending, num_success, num_error, num_requests } = status.state;
  console.log(\`  \${num_success + num_error}/\${num_requests} complete\`);

  if (num_requests > 0 && num_pending === 0) {
    clearInterval(interval);

    // Step 4: Retrieve and display results
    console.log("\\n--- Results ---");
    const resultsRes = await fetch(\`\${BASE_URL}/batches/\${batchId}/results?limit=100\`, { headers });
    const { results } = await resultsRes.json();

    // Create a lookup for original feedback text
    const feedbackLookup = Object.fromEntries(feedbackData.map((item) => [item.id, item.text]));

    const succeeded = results.filter((r) => r.batch_result?.response?.chat_get_completion);
    const failed = results.filter((r) => !r.batch_result?.response?.chat_get_completion);

    for (const result of succeeded) {
      const originalText = feedbackLookup[result.batch_request_id] ?? "";
      const sentiment = result.batch_result.response.chat_get_completion.choices[0].message.content.trim().toLowerCase();
      console.log(\`[\${sentiment.toUpperCase()}] \${originalText.slice(0, 50)}...\`);
    }

    // Report any failures
    if (failed.length > 0) {
      console.log("\\n--- Errors ---");
      for (const result of failed) {
        console.log(\`[\${result.batch_request_id}] \${result.error_message}\`);
      }
    }

    // Display cost
    let totalTicks = 0;
    for (const r of results) {
      totalTicks += r.batch_result?.response?.chat_get_completion?.usage?.cost_in_usd_ticks ?? 0;
    }
    console.log(\`\\nTotal cost: $\${(totalTicks / 1e10).toFixed(4)}\`);
  }
}, 2000);
```

## JSONL File Upload

As an alternative to adding requests via the SDK, you can create batches by uploading a JSONL file. This is useful when generating requests from scripts, pipelines, or external tools.

Each line in the file is a JSON object with four fields: `custom_id` (unique identifier, maps to `batch_request_id`), `method` (always `"POST"`), `url` (API endpoint path), and `body` (the JSON request payload matching the [REST API reference](/developers/rest-api-reference) for that endpoint).

```json
{"custom_id": "chat-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "grok-4.3", "messages": [{"role": "user", "content": "Classify this as positive, negative, or neutral: The product exceeded my expectations!"}]}}
{"custom_id": "search-1", "method": "POST", "url": "/v1/responses", "body": {"model": "grok-4.3", "tools": [{"type": "web_search"}, {"type": "x_search"}], "input": [{"role": "user", "content": "What are the latest SpaceX launches?"}]}}
{"custom_id": "mcp-1", "method": "POST", "url": "/v1/responses", "body": {"model": "grok-4.3", "tools": [{"type": "mcp", "server_label": "deepwiki", "server_url": "https://mcp.deepwiki.com/mcp"}], "input": [{"role": "user", "content": "What does the xai-sdk-python repo do?"}]}}
{"custom_id": "img-1", "method": "POST", "url": "/v1/images/generations", "body": {"model": "grok-imagine-image-quality", "prompt": "A futuristic city skyline at sunset"}}
{"custom_id": "img-edit-1", "method": "POST", "url": "/v1/images/edits", "body": {"model": "grok-imagine-image-quality", "prompt": "Add a rainbow", "image": {"url": "https://picsum.photos/800"}}}
{"custom_id": "vid-1", "method": "POST", "url": "/v1/videos/generations", "body": {"model": "grok-imagine-video", "prompt": "A rocket launching from Mars", "duration": 8}}
{"custom_id": "vid-edit-1", "method": "POST", "url": "/v1/videos/edits", "body": {"model": "grok-imagine-video", "prompt": "Make it slow motion", "video": {"url": "https://lorem.video/cat_360p_3s"}}}
{"custom_id": "vid-ext-1", "method": "POST", "url": "/v1/videos/extensions", "body": {"model": "grok-imagine-video", "prompt": "The camera slowly pans to reveal a sunset", "video": {"url": "https://lorem.video/cat_360p_3s"}, "duration": 6}}
```

You can mix different endpoints in the same file. Each request is routed independently.

Supported `url` values:

| URL | Description |
|---|---|
| `/v1/chat/completions` | [Chat completions](/developers/model-capabilities/text/generate-text) |
| `/v1/responses` | [Model responses](/developers/model-capabilities/text/generate-text) |
| `/v1/images/generations` | [Image generation](/developers/model-capabilities/images/generation) |
| `/v1/images/edits` | [Image editing](/developers/model-capabilities/images/editing) |
| `/v1/videos/generations` or `/v1/videos` | [Video generation](/developers/model-capabilities/video/generation) |
| `/v1/videos/edits` | [Video editing](/developers/model-capabilities/video/editing) |
| `/v1/videos/extensions` | [Video extension](/developers/model-capabilities/video/extension) |

Upload the file via the [Files API](/developers/files), then create a batch referencing it:

```pythonXAI
from xai_sdk import Client

client = Client()

# Upload the JSONL file
file = client.files.upload(
    file=open("batch_requests.jsonl", "rb"),
)

# Create a batch with the file ID
batch = client.batch.create(
    batch_name="sentiment_analysis",
    input_file_id=file.id,
)
print(f"Created batch: {batch.batch_id}")
```

```bash
# Upload the JSONL file
curl -X POST https://api.x.ai/v1/files \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -F file="@batch_requests.jsonl"

# Create a batch with the file ID
curl -X POST https://api.x.ai/v1/batches \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -d '{
    "name": "sentiment_analysis",
    "input_file_id": "file-abc123"
  }'
```

```javascriptWithoutSDK
import fs from "fs";

// Upload the JSONL file
const jsonlContent = fs.readFileSync("batch_requests.jsonl", "utf8");
const formData = new FormData();
formData.append("file", new Blob([jsonlContent], { type: "application/jsonl" }), "batch_requests.jsonl");

const uploadRes = await fetch("https://api.x.ai/v1/files", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.XAI_API_KEY}\` },
  body: formData,
});
const file = await uploadRes.json();

// Create a batch with the file ID
const batchRes = await fetch("https://api.x.ai/v1/batches", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.XAI_API_KEY}\`,
  },
  body: JSON.stringify({ name: "sentiment_analysis", input_file_id: file.id }),
});
const batch = await batchRes.json();
console.log(\`Created batch: \${batch.batch_id}\`);
```

The file is processed asynchronously in the background. If any line is invalid, the batch is cancelled with an error message. Monitor progress and retrieve results the same way as inline batches.

File-based batches are sealed after creation — you cannot add more requests via `AddBatchRequests`. Maximum file size is **200 MB** with up to **50,000** requests. Each `custom_id` must be unique within the file.

## Limitations

**Batches**

* A team can have an **unlimited** number of batches.
* Maximum batch creation rate: **2** batch creations per second per team.

**Batch Requests**

* A batch can contain an **unlimited** number of requests in theory, but extremely large batches (>1,000,000 requests) may be throttled for processing stability.
* Each individual request that can be added to a batch has a maximum payload size of **25MB**.
* A team can send up to **1000** add-batch-requests API calls every **30 seconds** (this is a rolling limit shared across all batches in the team).
* Image and video results contain signed URLs that expire after **1 hour**. Download the media promptly after retrieving results.

## Tool Use

Both [server-side tools](/developers/tools/overview) and client-side function tools are supported in batch requests.

* **Server-side tools** (web search, code execution, MCP, etc.) work the same as in the real-time API — they are executed during processing and the final response is returned.
* **Client-side function tools** are supported: the model returns `tool_calls` in the response for you to handle offline. Multi-turn tool calling requires submitting a new batch request with the tool result messages included in the conversation.

## Related

* [API Reference: Batch endpoints](/developers/rest-api-reference/inference/batches#create-a-new-batch)
* [gRPC Reference: Batch management](/developers/grpc-api-reference#batch-management)
* [Pricing — Batch API Pricing](/developers/pricing#batch-api-pricing)
* [xAI Python SDK](https://github.com/xai-org/xai-sdk-python)
