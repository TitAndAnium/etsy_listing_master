const fs = require("fs");
const path = require("path");

function extractPromptVersion(promptContent) {
  // Skip comment lines (starting with #) and find ::VERSION:: line
  const lines = promptContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue; // Skip empty lines and comments
    }
    const match = trimmed.match(/::VERSION::\s+v[\d.]+/);
    if (match) {
      return match[0].split('::VERSION::')[1].trim();
    }
    // If first non-comment line is not ::VERSION::, fail
    throw new Error("Prompt version header (::VERSION:: vX.X.X) missing or malformed.");
  }
  throw new Error("Prompt version header (::VERSION:: vX.X.X) missing or malformed.");
}

module.exports = function loadPromptWithVersion(promptFilePath) {
  const fullPath = path.join(__dirname, "..", "prompts", promptFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt file not found: ${promptFilePath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  
  // Strict version header validation - FAIL if missing
  let version;
  try {
    version = extractPromptVersion(raw);
  } catch (e) {
    throw new Error(`${promptFilePath}: ${e.message}`);
  }

  return {
    prompt: raw.trim(),
    prompt_version: version
  };
};
