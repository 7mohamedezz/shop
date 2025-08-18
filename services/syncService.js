const { getConnections, getLocalModels, getAtlasModels } = require('./db');

const queue = [];
let syncing = false;

async function enqueueSync(modelName, op, payload) {
  queue.push({ modelName, op, payload });
}

async function flushOnce() {
  const { atlasConn } = getConnections();
  const atlas = getAtlasModels();
  if (!atlasConn || !atlas) return;
  while (queue.length) {
    const job = queue.shift();
    const M = atlas[job.modelName];
    try {
      if (job.op === 'upsert') {
        if (job.payload && job.payload._id) {
          const id = job.payload._id;
          await M.updateOne({ _id: id }, { $set: job.payload }, { upsert: true });
        }
      } else if (job.op === 'update') {
        await M.updateOne({ _id: job.payload.id }, { $set: job.payload.update });
      } else if (job.op === 'delete') {
        await M.deleteOne({ _id: job.payload.id });
      }
    } catch (e) {
      // push back and stop to retry later
      queue.unshift(job);
      break;
    }
  }
}

function startBackgroundSync() {
  if (syncing) return;
  syncing = true;
  setInterval(() => {
    flushOnce().catch(() => {});
  }, 5000);
}

module.exports = { enqueueSync, startBackgroundSync };
