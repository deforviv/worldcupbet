const { runSettlement } = require("./src/modules/settlements/settlement.service");
(async () => {
  try {
    await runSettlement();
    console.log("runSettlement done");
  } catch (e) {
    console.error("runSettlement failed", e);
  }
  process.exit(0);
})();
