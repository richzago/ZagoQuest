import fs from "fs";
import path from "path";

export function loadMonster(filePath: string) {
  const fullPath = path.join(__dirname, "..", filePath);

  const data = fs.readFileSync(fullPath, "utf-8");

  return JSON.parse(data);
}
