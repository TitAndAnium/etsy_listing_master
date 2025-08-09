// functions/utils/loadRules.js
const fs   = require("fs");
const path = require("path");

module.exports = function loadRules(field) {
  // rules staan in /prompts/[field]_rules.txt (NIET in submap rules/)
  let file = path.join(__dirname, "..", "prompts", `${field}_rules.txt`);
  console.debug(`[DEBUG] Loading rules from path: ${file}`);
  
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    // Special case: try alias for tags (tags_rules.txt vs tag_rules.txt)
    if (field === 'tags') {
      const aliasFile = path.join(__dirname, "..", "prompts", "tag_rules.txt");
      console.debug(`[DEBUG] Trying alias path for tags: ${aliasFile}`);
      try {
        return fs.readFileSync(aliasFile, "utf8");
      } catch (aliasError) {
        console.warn(`[WARNING] Could not load rules for field: ${field}. Tried both ${file} and ${aliasFile}`);
        return ""; // Return empty string if both files don't exist
      }
    }
    
    console.warn(`[WARNING] Could not load rules for field: ${field}. File: ${file}`);
    return ""; // Return empty string if rules file doesn't exist
  }
};
