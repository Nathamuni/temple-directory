import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const checklist = JSON.parse(readFileSync(join(root, 'data', 'facilities-checklist.json'), 'utf8'));
export const ITEM_KEYS = new Set(checklist.groups.flatMap(g => g.items.map(i => i.key)));
export const fieldSchema = JSON.parse(readFileSync(join(root, 'data', 'field-schema.json'), 'utf8'));
export const FIELDS = new Map(fieldSchema.groups.flatMap(g => g.fields.map(f => [f.key, f])));
export const needCategories = JSON.parse(readFileSync(join(root, 'data', 'need-categories.json'), 'utf8'));
