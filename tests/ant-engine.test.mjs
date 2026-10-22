import { AntWorld } from "../src/scripts/ant-engine.mjs";
function check(value, message) { if (!value) throw new Error(message); }
const world = new AntWorld();
const ref = new Set();
let x = 0, y = 0, dir = 0;
for (let i = 0; i < 100000; i++) {
  const key = x + "," + y, state = ref.has(key);
  dir = (dir + (state ? 3 : 1)) % 4;
  if (state) ref.delete(key); else ref.add(key);
  if (dir === 0) y--; else if (dir === 1) x++; else if (dir === 2) y++; else x--;
  check(world.step(), "Unexpected memory limit");
  const ant = world.ants[0];
  check(ant.x === x && ant.y === y && ant.dir === dir && world.active === ref.size, "Reference mismatch at " + i);
}
for (const key of ref) {
  const [cx, cy] = key.split(",").map(Number);
  check(world.get(cx, cy) === 1, "Missing active cell");
}
const cells = new AntWorld();
for (const value of [-65, -33, -32, -1, 0, 31, 32, 64]) {
  cells.flip(value, value); check(cells.get(value, value) === 1, "Negative coordinate addressing");
  cells.flip(value, value); check(cells.get(value, value) === 0, "Cell clearing");
}
check(cells.tiles.size === 0 && cells.active === 0, "Empty chunks retained");
const bounded = new AntWorld({ maxTiles: 1 });
bounded.flip(0, 0);
bounded.ants = [{ x: 32, y: 0, dir: 0 }];
check(!bounded.step() && bounded.limit && bounded.ticks === 0 && bounded.ants[0].x === 32, "Limit mutated a tick");
const collide = new AntWorld({ spawn: true, maxAnts: 3, random: () => .5 });
collide.ants = [{ x: -1, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 }];
collide.step();
check(collide.ants.length === 3, "Collision failed to spawn");
collide.ants = [{ x: -1, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 }, { x: 5, y: 5, dir: 0 }];
collide.tiles.clear(); collide.active = 0;
collide.step();
check(collide.ants.length === 3, "Ant cap exceeded");
const noSpawn = new AntWorld();
noSpawn.ants = [{ x: -1, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 }];
noSpawn.step(); check(noSpawn.ants.length === 2, "Disabled spawning added ants");
const many = new AntWorld({ count: 100, maxAnts: 500 });
check(many.ants.length === 100 && new Set(many.ants.map(a => a.x + "," + a.y)).size === 100, "Duplicate starting ants");
for (let i = 0; i < 2000; i++) check(many.step(), "Multi-ant run stopped early");
check(many.active >= 0 && many.active <= many.tiles.size * 1024, "Invalid active count");
console.log("PASS: reference (100,000 ticks), chunk reclamation, negative coordinates, atomic memory limit, collision spawning, ant cap, disabled spawning, unique starts, multi-ant run");

// Grow across the population boundary, then keep simulating at the cap.
const capped = new AntWorld({ spawn: true, maxAnts: 1500, random: () => .5 });
capped.ants = [{ x: -1, y: 0, dir: 0 }, { x: 1, y: 0, dir: 2 },
  ...Array.from({ length: 1497 }, (_, i) => ({ x: 100 + i * 2, y: 100, dir: 0 }))];
check(capped.step() && capped.ants.length === 1500, "Did not grow to 1,500 ants");
const before = JSON.stringify(capped.ants);
for (let i = 0; i < 100; i++) {
  check(capped.step(), "Simulation stopped at population cap");
  check(capped.ants.length === 1500 && !capped.limit, "Population cap paused or added ants");
}
check(capped.ticks === 101 && JSON.stringify(capped.ants) !== before, "Ants did not keep moving");
check(new AntWorld({ maxAnts: 9999 }).maxAnts === 1500, "Population ceiling missing");
console.log("PASS: grows to 1,500 ants, keeps moving at cap, enforces ceiling");
