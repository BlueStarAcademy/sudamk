import * as db from '../db.js';

async function run() {
  console.log('[restoreInventoryStatus] start');
  await db.initializeDatabase();

  const users = await db.getAllUsers({ includeEquipment: true, includeInventory: true, skipCache: true });
  console.log(`[restoreInventoryStatus] loaded users: ${users.length}`);

  let restoredCount = 0;
  for (const user of users) {
    const inventoryCount = Array.isArray(user.inventory) ? user.inventory.length : 0;
    const equipmentCount = user.equipment ? Object.keys(user.equipment).length : 0;

    // updateUser -> serializeUser 경로를 통해 status의 inventoryRaw/equipmentRaw를 테이블 기준으로 재기록
    await db.updateUser(user);

    if (inventoryCount > 0 || equipmentCount > 0) restoredCount++;
  }

  console.log(`[restoreInventoryStatus] completed. restored users (has inventory/equipment): ${restoredCount}`);
}

run()
  .then(() => {
    console.log('[restoreInventoryStatus] done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[restoreInventoryStatus] failed:', error);
    process.exit(1);
  });

