#!/usr/bin/env node
/*
  Wipes collections: Customers, Invoices, ReturnInvoices, Products, Plumbers
  Usage examples:
    node scripts/wipe.js --local --yes
    node scripts/wipe.js --atlas --yes
    node scripts/wipe.js --both --yes
*/

require('dotenv').config();
const { connectLocalDb, connectAtlasDb, getLocalModels, getAtlasModels, getConnections } = require('../services/db');

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  return {
    local: flags.has('--local'),
    atlas: flags.has('--atlas'),
    both: flags.has('--both'),
    yes: flags.has('--yes'),
  };
}

async function main() {
  const { local, atlas, both, yes } = parseArgs();
  if (!yes) {
    console.error('Refusing to wipe without --yes confirmation.');
    process.exit(1);
  }
  const targetLocal = both || local || (!local && !atlas && !both); // default to local if none specified
  const targetAtlas = both || atlas;

  console.log('Wipe targets:', { local: targetLocal, atlas: targetAtlas });

  if (!targetLocal && !targetAtlas) {
    console.error('Nothing to do. Specify --local, --atlas, or --both.');
    process.exit(1);
  }

  // Ensure connections
  if (targetLocal) {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/plumbing_shop';
    await connectLocalDb(uri);
  }
  if (targetAtlas) {
    const uri = process.env.MONGODB_ATLAS_URI || '';
    if (!uri) {
      console.warn('No MONGODB_ATLAS_URI configured; skipping Atlas wipe.');
    } else {
      await connectAtlasDb(uri);
    }
  }

  const tasks = [];

  async function wipeModels(models, label) {
    if (!models) return;
    console.log(`\n⚠️  Wiping ${label} collections...`);
    const { Customer, Invoice, ReturnInvoice, Product, Plumber } = models;
    const ops = [
      Customer.deleteMany({}),
      Invoice.deleteMany({}),
      ReturnInvoice.deleteMany({}),
      Product.deleteMany({}),
      Plumber.deleteMany({})
    ];
    const [cRes, iRes, rRes, pRes, plRes] = await Promise.all(ops);
    console.log(`[${label}] Deleted Customers: ${cRes.deletedCount}`);
    console.log(`[${label}] Deleted Invoices: ${iRes.deletedCount}`);
    console.log(`[${label}] Deleted ReturnInvoices: ${rRes.deletedCount}`);
    console.log(`[${label}] Deleted Products: ${pRes.deletedCount}`);
    console.log(`[${label}] Deleted Plumbers: ${plRes.deletedCount}`);
  }

  try {
    if (targetLocal) tasks.push(wipeModels(getLocalModels(), 'Local'));
    if (targetAtlas) tasks.push(wipeModels(getAtlasModels(), 'Atlas'));
    await Promise.all(tasks);
    console.log('\n✅ Wipe completed.');
  } catch (err) {
    console.error('❌ Wipe failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    const { localConn, atlasConn } = getConnections();
    await Promise.all([
      localConn?.close().catch(() => {}),
      atlasConn?.close().catch(() => {}),
    ]);
  }
}

main();
