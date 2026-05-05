/**
 * openhorse - 工具集
 *
 * 定义 Agent 可用的工具（Tool System v2）：
 *   - read_file: 读取文件内容
 *   - write_file: 写入文件
 *   - list_files: 列出目录
 *   - exec_command: 执行 shell 命令
 *
 * 使用 buildTool() 工厂模式。
 */

import { execFile } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, createReadStream } from 'fs';
import { join, resolve, relative, extname } from 'path';
import { createInterface } from 'readline';
import { buildTool, type OpenHorseTool, type ToolResult, type ToolContext } from '../framework/tool';

// ============================================================================
// 工具集
// ============================================================================

export const TOOLS: OpenHorseTool[] = [
  buildTool({
    name: 'read_file',
    description: '读取文件的全部内容。返回文件内容字符串。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径或相对路径）',
        },
        maxLines: {
          type: 'number',
          description: '最大读取行数（可选，默认 500 行）',
        },
      },
      required: ['path'],
    },
    execute: async (args) => {
      return readFileSync_(args.path as string, args.maxLines as number | undefined);
    },
    isReadOnly: () => true,
    userFacingName: (args) => `Read ${args.path as string}`,
  }),

  buildTool({
    name: 'write_file',
    description: '将内容写入文件。如果文件不存在则创建，存在则覆盖。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径或相对路径）',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['path', 'content'],
    },
    execute: async (args) => {
      return writeFileSync_(args.path as string, args.content as string);
    },
    isDestructive: () => true,
    checkPermissions: (args, context) => {
      // Destructive operation - ask for confirmation in default mode
      return { behavior: 'ask', reason: 'Write operation may modify existing files' };
    },
    userFacingName: (args) => `Write ${args.path as string}`,
  }),

  buildTool({
    name: 'list_files',
    description: '列出指定目录中的文件和子目录。支持控制递归深度。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径（绝对路径或相对路径）',
        },
        maxDepth: {
          type: 'number',
          description: '最大递归深度（可选，默认 2）',
        },
      },
      required: ['path'],
    },
    execute: async (args) => {
      return listFiles_(args.path as string, args.maxDepth as number | undefined);
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    userFacingName: (args) => `List ${args.path as string}`,
  }),

  buildTool({
    name: 'exec_command',
    description: '执行一个 shell 命令。返回 stdout 和 stderr。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的 shell 命令',
        },
        cwd: {
          type: 'string',
          description: '工作目录（可选，默认当前目录）',
        },
        timeout: {
          type: 'number',
          description: '超时时间 ms（可选，默认 30000）',
        },
      },
      required: ['command'],
    },
    execute: async (args) => {
      return execCommand_(args.command as string, args.cwd as string | undefined, args.timeout as number | undefined);
    },
    isDestructive: (args) => {
      const cmd = (args.command as string) || '';
      return /(rm\s+-rf|mkfs|dd\s)/.test(cmd);
    },
    checkPermissions: (args, context) => {
      const cmd = (args.command as string) || '';
      // Block truly dangerous commands
      const blockedPatterns = [
        /rm\s+-rf\s+\/$/,
        /mkfs/,
        /dd\s+of=\/dev/,
        /:\(\)\s*\{/,  // fork bomb
      ];
      for (const pat of blockedPatterns) {
        if (pat.test(cmd)) {
          return { behavior: 'deny', reason: `Command blocked by safety policy: ${cmd.slice(0, 50)}` };
        }
      }
      // Ask for potentially destructive commands
      if (/(rm\s+-rf|rm\s+-r|chmod|chown|kill|pkill)/.test(cmd)) {
        return { behavior: 'ask', reason: 'Command may have destructive effects' };
      }
      // Allow safe commands
      return { behavior: 'allow' };
    },
    userFacingName: (args) => `Exec ${(args.command as string)?.slice(0, 60) || ''}`,
  }),

  buildTool({
    name: 'edit_file',
    description: '对文件进行精确字符串替换。old_string 必须在文件中唯一匹配，否则拒绝执行。使用 replace_all 可替换所有匹配。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径（绝对路径或相对路径）',
        },
        old_string: {
          type: 'string',
          description: '要替换的字符串（必须精确匹配）',
        },
        new_string: {
          type: 'string',
          description: '替换后的字符串',
        },
        replace_all: {
          type: 'boolean',
          description: '是否替换所有匹配（可选，默认 false）',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    execute: async (args) => {
      return editFile_(args.path as string, args.old_string as string, args.new_string as string, args.replace_all as boolean | undefined);
    },
    isDestructive: () => true,
    checkPermissions: (args, context) => {
      return { behavior: 'ask', reason: 'Edit operation modifies file contents' };
    },
    userFacingName: (args) => `Edit ${args.path as string}`,
  }),

  buildTool({
    name: 'glob',
    description: '使用 glob 模式搜索文件。支持 **（递归）、*（任意字符）、?（单个字符）等通配符。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob 模式（如 **/*.ts, src/**/*.js）',
        },
        path: {
          type: 'string',
          description: '搜索起始目录（可选，默认当前目录）',
        },
      },
      required: ['pattern'],
    },
    execute: async (args) => {
      return glob_(args.pattern as string, args.path as string | undefined);
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    userFacingName: (args) => `Glob ${args.pattern as string}`,
  }),

  buildTool({
    name: 'grep',
    description: '在文件中搜索正则表达式模式。返回匹配的文件路径和行内容。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '正则表达式模式',
        },
        path: {
          type: 'string',
          description: '搜索路径（可选，默认当前目录）',
        },
        glob: {
          type: 'string',
          description: '文件过滤模式（可选，如 *.ts）',
        },
        context: {
          type: 'number',
          description: '上下文行数（可选，默认 0）',
        },
      },
      required: ['pattern'],
    },
    execute: async (args) => {
      return grep_(args.pattern as string, args.path as string | undefined, args.glob as string | undefined, args.context as number | undefined);
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    userFacingName: (args) => `Grep ${args.pattern as string}`,
  }),
];

// ============================================================================
// 工具实现
// ============================================================================

/** 安全路径解析 — 防止路径遍历攻击 */
function safePath(input: string): string {
  const resolved = resolve(input);
  const cwd = process.cwd();
  if (relative(cwd, resolved).startsWith('..')) {
    return cwd;
  }
  return resolved;
}

async function readFileSync_(path: string, maxLines?: number): Promise<ToolResult> {
  try {
    const resolved = safePath(path);
    if (!existsSync(resolved)) {
      return { success: false, output: '', error: `File not found: ${path}` };
    }
    if (statSync(resolved).isDirectory()) {
      return { success: false, output: '', error: `Path is a directory, not a file: ${path}` };
    }

    const content = readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');
    const limit = maxLines ?? 500;

    if (lines.length > limit) {
      return {
        success: true,
        output: lines.slice(0, limit).join('\n') + `\n\n[... truncated, ${lines.length - limit} more lines]`,
      };
    }

    return { success: true, output: content };
  } catch (err: any) {
    return { success: false, output: '', error: String(err.message) };
  }
}

async function writeFileSync_(path: string, content: string): Promise<ToolResult> {
  try {
    const resolved = safePath(path);
    writeFileSync(resolved, content, 'utf-8');
    return { success: true, output: `Wrote ${content.split('\n').length} lines to ${path}` };
  } catch (err: any) {
    return { success: false, output: '', error: String(err.message) };
  }
}

async function listFiles_(path: string, maxDepth?: number): Promise<ToolResult> {
  const resolved = safePath(path);
  if (!existsSync(resolved)) {
    return { success: false, output: '', error: `Path not found: ${path}` };
  }
  if (!statSync(resolved).isDirectory()) {
    return { success: true, output: path };
  }

  const depth = maxDepth ?? 2;
  const results: string[] = [];

  function walk(dir: string, currentDepth: number, prefix: string) {
    if (currentDepth > depth) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        const fullPath = join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          results.push(`${relPath}/`);
          walk(fullPath, currentDepth + 1, relPath);
        } else {
          results.push(relPath);
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  walk(resolved, 1, '');
  return { success: true, output: results.join('\n') };
}

async function execCommand_(command: string, cwd?: string, timeout?: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    const workdir = cwd ? safePath(cwd) : process.cwd();
    const timeoutMs = timeout ?? 30000;

    execFile('sh', ['-c', command], {
      cwd: workdir,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      const output = stdout.toString().trim();
      const errOutput = stderr.toString().trim();

      if (error) {
        resolve({
          success: false,
          output: output || errOutput,
          error: error.message || `Command exited with code ${error.code}`,
        });
      } else {
        resolve({
          success: true,
          output: output || '(no output)',
          error: errOutput || undefined,
        });
      }
    });
  });
}

async function editFile_(path: string, old_string: string, new_string: string, replace_all?: boolean): Promise<ToolResult> {
  try {
    const resolved = safePath(path);
    if (!existsSync(resolved)) {
      return { success: false, output: '', error: `File not found: ${path}` };
    }
    if (statSync(resolved).isDirectory()) {
      return { success: false, output: '', error: `Path is a directory, not a file: ${path}` };
    }

    const content = readFileSync(resolved, 'utf-8');

    // Check if old_string exists
    const count = (content.match(new RegExp(escapeRegExp(old_string), 'g')) || []).length;
    if (count === 0) {
      return { success: false, output: '', error: `old_string not found in file: ${old_string.slice(0, 100)}...` };
    }

    // If not replace_all, require unique match
    if (!replace_all && count > 1) {
      return {
        success: false,
        output: '',
        error: `old_string found ${count} times in file. Use replace_all=true to replace all occurrences, or provide a more specific string that matches exactly once.`,
      };
    }

    // Perform replacement
    let newContent: string;
    if (replace_all) {
      newContent = content.split(old_string).join(new_string);
    } else {
      // Replace first occurrence only
      const idx = content.indexOf(old_string);
      newContent = content.slice(0, idx) + new_string + content.slice(idx + old_string.length);
    }

    writeFileSync(resolved, newContent, 'utf-8');

    return {
      success: true,
      output: `Replaced ${count} occurrence(s) of old_string with new_string in ${path}`,
    };
  } catch (err: any) {
    return { success: false, output: '', error: String(err.message) };
  }
}

/** Escape special regex characters for literal matching */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Glob/Grep 工具实现
// ============================================================================

/**
 * Glob 模式匹配 - 简化版实现
 * 支持: **（递归目录）、*（任意字符）、?（单个字符）
 */
async function glob_(pattern: string, basePath?: string): Promise<ToolResult> {
  try {
    const base = basePath ? safePath(basePath) : process.cwd();
    if (!existsSync(base)) {
      return { success: false, output: '', error: `Path not found: ${basePath}` };
    }
    if (!statSync(base).isDirectory()) {
      return { success: false, output: '', error: `Path is not a directory: ${basePath}` };
    }

    const results: string[] = [];

    // Convert glob pattern to regex
    function globToRegex(pat: string): RegExp {
      // Use placeholders to avoid interference between replacements
      let regex = pat;

      // **/ at start - matches optional path (including empty)
      regex = regex.replace(/^\*\*\//, '<<STARSTAR_SLASH_START>>');

      // **/ in middle - matches any number of path segments
      regex = regex.replace(/\*\*\//g, '<<STARSTAR_SLASH>>');

      // standalone ** - matches anything
      regex = regex.replace(/\*\*/g, '<<STARSTAR>>');

      // escape dots
      regex = regex.replace(/\./g, '\\.');

      // * matches anything except /
      regex = regex.replace(/\*/g, '[^/]*');

      // ? matches single char except /
      regex = regex.replace(/\?/g, '[^/]');

      // Now restore ** placeholders
      regex = regex.replace(/<<STARSTAR_SLASH_START>>/g, '(.*\\/)?');
      regex = regex.replace(/<<STARSTAR_SLASH>>/g, '([^/]+\\/)*');
      regex = regex.replace(/<<STARSTAR>>/g, '.*');

      return new RegExp(`^${regex}$`);
    }

    const regex = globToRegex(pattern);

    // Recursive walk
    function walk(dir: string, prefix: string) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;

          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            walk(join(dir, entry.name), relPath);
          } else {
            if (regex.test(relPath)) {
              results.push(relPath);
            }
          }
        }
      } catch {
        // skip unreadable directories
      }
    }

    walk(base, '');

    if (results.length === 0) {
      return { success: true, output: 'No files found matching pattern' };
    }

    return { success: true, output: results.sort().join('\n') };
  } catch (err: any) {
    return { success: false, output: '', error: String(err.message) };
  }
}

/**
 * Grep 搜索 - 在文件中搜索正则表达式
 */
async function grep_(pattern: string, basePath?: string, globPattern?: string, contextLines?: number): Promise<ToolResult> {
  try {
    const base = basePath ? safePath(basePath) : process.cwd();
    if (!existsSync(base)) {
      return { success: false, output: '', error: `Path not found: ${basePath}` };
    }

    const regex = new RegExp(pattern, 'g');
    const context = contextLines ?? 0;
    const results: string[] = [];
    const maxResults = 100;

    // Get list of files to search
    const files: string[] = [];

    function collectFiles(dir: string) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            collectFiles(fullPath);
          } else {
            // Check glob filter if provided
            if (globPattern) {
              const ext = extname(entry.name);
              if (!matchGlobSimple(entry.name, globPattern)) continue;
            }
            files.push(fullPath);
          }
        }
      } catch {
        // skip unreadable
      }
    }

    function matchGlobSimple(name: string, pat: string): boolean {
      const regex = pat.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\./g, '\\.');
      return new RegExp(`^${regex}$`).test(name);
    }

    if (statSync(base).isDirectory()) {
      collectFiles(base);
    } else {
      files.push(base);
    }

    // Search each file
    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const rl = createInterface({
          input: createReadStream(file, { encoding: 'utf-8' }),
          crlfDelay: Infinity,
        });

        const lines: string[] = [];
        const relPath = relative(base, file);

        rl.on('line', (line) => {
          lines.push(line);
        });

        await new Promise<void>((resolve) => {
          rl.on('close', resolve);
        });

        // Search for matches
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          if (regex.test(lines[i])) {
            // Format: file:line:content
            const start = Math.max(0, i - context);
            const end = Math.min(lines.length - 1, i + context);

            if (context > 0) {
              results.push(`${relPath}:${i + 1}:`);
              for (let j = start; j <= end; j++) {
                const prefix = j === i ? '>' : ' ';
                results.push(`  ${prefix}${j + 1}: ${lines[j]}`);
              }
              results.push('');
            } else {
              results.push(`${relPath}:${i + 1}: ${lines[i]}`);
            }
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    if (results.length === 0) {
      return { success: true, output: 'No matches found' };
    }

    return { success: true, output: results.slice(0, maxResults).join('\n') };
  } catch (err: any) {
    return { success: false, output: '', error: String(err.message) };
  }
}

// ============================================================================
// 统一执行入口
// ============================================================================

/**
 * 执行一个工具调用，返回结构化结果字符串
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    return JSON.stringify({
      success: false,
      error: `Unknown tool: ${name}. Available tools: ${TOOLS.map(t => t.name).join(', ')}`,
    });
  }

  const context: ToolContext = {
    cwd: process.cwd(),
    config: {
      name: 'openhorse',
      mode: 'development',
    },
  };

  const result = await tool.execute(args, context);

  if (!result.success) {
    return JSON.stringify({
      success: false,
      error: result.error,
      output: result.output,
    });
  }

  return JSON.stringify({
    success: true,
    output: result.output,
  });
}

/**
 * 获取可用工具名称列表
 */
export function getToolNames(): string {
  return TOOLS.map(t => t.name).join(', ');
}
