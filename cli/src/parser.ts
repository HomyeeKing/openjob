import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { CronExpressionParser } from 'cron-parser';
import { JobDefinition } from './types';

export function parseJob(filePath: string): JobDefinition {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const { data, content } = matter(raw);

  // Validate required fields
  for (const field of ['name', 'cron', 'description'] as const) {
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      throw new Error(`Missing or invalid required field: ${field}`);
    }
  }

  // Validate cron expression
  try { 
    CronExpressionParser.parse(data.cron as string); 
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid cron expression "${data.cron}": ${errorMsg}`);
  }

  return {
    name: data.name as string,
    cron: data.cron as string,
    description: data.description as string,
    condition: (data.condition as string) || '',
    allowedSkills: (data.allowedSkills as string[]) || [],
    timeout: (data.timeout as number) || 60,
    retry: (data.retry as number) || 0,
    tags: (data.tags as string[]) || [],
    command: (data.command as string) || '',
    cwd: (data.cwd as string) || '',
    body: content.trim(),
    source: abs,
    sourcePath: abs
  };
}
