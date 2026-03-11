/**
 * Truncates all tables in dependency order.
 * Run once before deploying the data-isolation fix.
 * Usage: npx tsx script/truncate-all.ts
 */
import { pool } from "../server/db";

async function truncateAll() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Leaf tables first, then parent tables
    const tables = [
      "assistant_messages",
      "idea_comments",
      "idea_assignments",
      "assistant_conversations",
      "ideas",
      "content",
      "sources",
      "folders",
      "settings",
      "prompt_templates",
      "style_examples",
      "otp_codes",
      "session",
      "users",
    ];

    for (const table of tables) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
      console.log(`Truncated: ${table}`);
    }

    await client.query("COMMIT");
    console.log("\nAll tables truncated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Truncate failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

truncateAll();
