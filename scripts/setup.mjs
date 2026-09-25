import { copyFileSync, constants } from "node:fs";
try {
  copyFileSync(".env.example", ".env.local", constants.COPYFILE_EXCL);
  console.log("Created .env.local in mock mode. No provider credentials are needed for the transport check.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env.local already exists; preserved it.");
}
console.log("Start LiveKit: livekit-server --dev\nStart web app: npm run dev\nStart agent in another terminal: npm run agent");
