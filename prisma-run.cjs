const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = __dirname;
const version = '605197351a3c8bdd595af2d2a9bc3025bca48ea2';
const cacheDir = path.join(root, 'node_modules', '.cache', 'prisma', 'master', version, 'windows');
const enginesDir = path.join(root, 'node_modules', '@prisma', 'engines');

// Résolution d'un engine : cache local d'abord, puis le paquet @prisma/engines.
// Sur cette machine le cache ne contient que le query engine ; le schema engine
// n'existe que dans @prisma/engines. Sans ce repli, `prisma migrate` échoue.
function resolveEngine(fileName) {
  const candidates = [
    path.join(cacheDir, fileName),
    path.join(enginesDir, fileName),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Engine Prisma introuvable : ${fileName}\nCherché dans :\n  ${candidates.join('\n  ')}`,
    );
  }
  return found;
}

const queryEngine = resolveEngine('query_engine-windows.dll.node');
const schemaEngine = resolveEngine('schema-engine-windows.exe');

const env = {
  ...process.env,
  PRISMA_QUERY_ENGINE_LIBRARY: queryEngine,
  PRISMA_SCHEMA_ENGINE_BINARY: schemaEngine,
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  CHECKPOINT_DISABLE: '1',
  PRISMA_TELEMETRY_DISABLED: '1',
  ...(process.env.PRISMA_INSECURE_TLS === '1' ? { NODE_TLS_REJECT_UNAUTHORIZED: '0' } : {}),
};

const args = process.argv.slice(2);
const prismaJs = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

try {
  const out = execFileSync(process.execPath, [prismaJs, ...args], {
    env,
    stdio: 'inherit',
    cwd: root,
    timeout: 120000,
  });
} catch (err) {
  if (err.status) process.exit(err.status);
  console.error(err.message);
  process.exit(1);
}
