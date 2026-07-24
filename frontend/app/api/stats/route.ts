import { NextResponse } from 'next/server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  let envPath = path.resolve(process.cwd(), '../.env');
  let envVars: Record<string, string> = {};
  
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1].trim()] = match[2].trim();
        }
      });
    }
  } catch (e) {
    console.error("Error reading .env:", e);
  }

  const host = envVars.CCRAS_DB_HOST || envVars.POSTGRES_SERVER || process.env.CCRAS_DB_HOST || '100.101.210.91';
  const port = parseInt(envVars.CCRAS_DB_PORT || envVars.POSTGRES_PORT || process.env.CCRAS_DB_PORT || '5432');
  const database = envVars.CCRAS_DB_NAME || envVars.POSTGRES_DB || process.env.CCRAS_DB_NAME || 'ccras_db';
  const user = envVars.CCRAS_DB_USER || envVars.POSTGRES_USER || process.env.CCRAS_DB_USER || 'anshika';
  const password = envVars.CCRAS_DB_PASSWORD || envVars.POSTGRES_PASSWORD || process.env.CCRAS_DB_PASSWORD || 'anshi_123';

  const client = new Client({ host, port, database, user, password });

  const getCount = async (table: string): Promise<number> => {
    try {
      const res = await client.query(`SELECT count(*) FROM "${table}"`);
      return parseInt(res.rows[0].count, 10);
    } catch {
      return 0;
    }
  };

  try {
    await client.connect();

    // Papers Ingested: main papers + uploaded papers
    const papers = await getCount('papers');
    const uploadedPapers = await getCount('uploaded_papers');
    const papersIngested = papers + uploadedPapers;

    // Entities Discovered: all entities extracted
    const entitiesDiscovered = await getCount('entities');

    // Active Hypotheses: hypothesis_seeds table
    const activeHypotheses = await getCount('hypothesis_seeds');

    // Graph Nodes: relationship_instances (edges/connections in the knowledge graph)
    const graphNodes = await getCount('relationship_instances');

    // Research Gaps: gap_candidates table
    const researchGaps = await getCount('gap_candidates');

    // Contradictions: studies with specific status or search_logs flagged
    const contradictions = await getCount('studies');

    // Extra useful stats
    const users = await getCount('users');
    const collections = await getCount('collections');
    const searchLogs = await getCount('search_logs');
    const paperChunks = await getCount('paper_chunks');
    const keywords = await getCount('keywords');
    const paperEntities = await getCount('paper_entities');
    const chatMessages = await getCount('chat_messages');
    const libraryPapers = await getCount('library_papers');

    await client.end();

    return NextResponse.json({
      papersIngested,
      entitiesDiscovered,
      activeHypotheses,
      graphNodes,
      researchGaps,
      contradictions,
      // breakdown
      papers,
      uploadedPapers,
      users,
      collections,
      searchLogs,
      paperChunks,
      keywords,
      paperEntities,
      chatMessages,
      libraryPapers,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    if (client) await client.end().catch(() => {});
    return NextResponse.json({ error: 'Failed to fetch stats', details: error.message }, { status: 500 });
  }
}
