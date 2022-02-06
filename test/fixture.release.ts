const vite = require('@vite/vuilder');

export async function mochaGlobalSetup() {
  await vite.startLocalNetwork("release");
  console.log(`Test environment is ready.`);
}
export const mochaGlobalTeardown = async () => {
  await vite.stopLocalNetwork();
  console.log("Test environment cleared.");
};
