import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.buffer.com';

const token = process.env.BUFFER_API_KEY;

if (!token) {
  throw new Error('Missing BUFFER_API_KEY');
}

async function gql(query) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const body = await r.json();

  if (!r.ok || body.errors) {
    throw new Error(
      `Buffer API error: ${JSON.stringify(body)}`
    );
  }

  return body.data;
}

function esc(s) {
  return JSON.stringify(s);
}

/*
 * 1. Get Buffer organization
 */
const orgData = await gql(`
  query GetOrganizations {
    account {
      organizations {
        id
        name
      }
    }
  }
`);

const org = orgData.account?.organizations?.[0];

if (!org) {
  throw new Error('No Buffer organization found');
}

console.log(`Organization: ${org.name}`);

/*
 * 2. Get connected channels
 */
const channelsData = await gql(`
  query GetChannels {
    channels(
      input: {
        organizationId: ${esc(org.id)}
      }
    ) {
      id
      name
      displayName
      service
      isQueuePaused
    }
  }
`);

/*
 * Prefer the Facebook channel named
 * "Trợ giúp sinh viên".
 * If the exact name cannot be found,
 * fall back to the first Facebook channel.
 */
const fb =
  channelsData.channels.find(
    (c) =>
      c.service === 'facebook' &&
      `${c.displayName || ''} ${c.name || ''}`
        .toLowerCase()
        .includes('trợ giúp sinh viên'.toLowerCase())
  ) ||
  channelsData.channels.find(
    (c) => c.service === 'facebook'
  );

if (!fb) {
  throw new Error('No Facebook channel found in Buffer');
}

if (fb.isQueuePaused) {
  throw new Error('Facebook Buffer queue is paused');
}

console.log(
  `Facebook channel: ${fb.displayName || fb.name}`
);

/*
 * 3. Check current Buffer queue
 */
const scheduledData = await gql(`
  query GetScheduledPosts {
    posts(
      input: {
        organizationId: ${esc(org.id)}
        sort: [
          {
            field: dueAt
            direction: asc
          }
          {
            field: createdAt
            direction: desc
          }
        ]
        filter: {
          status: [scheduled]
          channelIds: [${esc(fb.id)}]
        }
      }
    ) {
      edges {
        node {
          id
          text
          createdAt
          dueAt
          channelId
        }
      }
    }
  }
`);

const scheduledCount =
  scheduledData.posts?.edges?.length || 0;

const maxScheduled = Number(
  process.env.MAX_BUFFER_QUEUE || '6'
);

console.log(
  `Buffer currently has ${scheduledCount} scheduled post(s).`
);

if (scheduledCount >= maxScheduled) {
  console.log(
    `Buffer already has ${scheduledCount} scheduled posts; no new post added.`
  );
  process.exit(0);
}

/*
 * 4. Read marketing content queue
 */
const queuePath = path.resolve(
  'content/queue.json'
);

const queue = JSON.parse(
  fs.readFileSync(queuePath, 'utf8')
);

if (!Array.isArray(queue)) {
  throw new Error(
    'content/queue.json must contain a JSON array'
  );
}

/*
 * 5. Select next unpublished post
 */
const next = queue.find(
  (x) =>
    !x.bufferPostId &&
    x.status !== 'skip'
);

if (!next) {
  console.log(
    'No unpublished content remains in content/queue.json'
  );
  process.exit(0);
}

if (!next.text) {
  throw new Error(
    `Queue item ${next.id || '(unknown)'} has no text`
  );
}

console.log(
  `Next campaign post: ${next.id || '(unnamed)'}`
);

/*
 * 6. Add normal Facebook feed post to Buffer
 *
 * Facebook requires metadata.facebook.type.
 */
const mutation = `
  mutation CreatePost {
    createPost(
      input: {
        text: ${esc(next.text)}
        channelId: ${esc(fb.id)}
        schedulingType: automatic
        mode: addToQueue
        metadata: {
          facebook: {
            type: post
          }
        }
      }
    ) {
      ... on PostActionSuccess {
        post {
          id
          text
          dueAt
        }
      }

      ... on MutationError {
        message
      }
    }
  }
`;

const result = await gql(mutation);

const payload = result.createPost;

if (!payload?.post?.id) {
  throw new Error(
    `CreatePost failed: ${JSON.stringify(payload)}`
  );
}

/*
 * 7. Record Buffer result locally
 */
next.bufferPostId = payload.post.id;
next.status = 'buffer_accepted';
next.queuedAt = new Date().toISOString();
next.dueAt =
  payload.post.dueAt || null;

fs.writeFileSync(
  queuePath,
  JSON.stringify(queue, null, 2) + '\n'
);

console.log(
  `SUCCESS: Queued post ${next.id || '(unnamed)'} to Facebook channel "${fb.displayName || fb.name}".`
);

console.log(
  `Buffer post id: ${payload.post.id}`
);

console.log(
  `Due at: ${
    payload.post.dueAt ||
    'Buffer queue time'
  }`
);

console.log(
  'Buffer transfer finished. Final Facebook publication must be verified at the destination before reporting SUCCESS.'
);
