import { seedMarketUniverseRegistry } from "../server/crypto/marketUniverse.ts";

const outcome = await seedMarketUniverseRegistry();
console.log(JSON.stringify({ action: "seed-market-universe", ...outcome }, null, 2));
