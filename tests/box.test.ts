import { toolLine, renderHeaderBox, renderPromptSeparator, renderFooterBar } from '../src/ui/box';

describe('toolLine', () => {
  test('includes tool name in output', () => {
    const line = toolLine('read_file', { path: '/test' }, true, 50);
    expect(line).toContain('read_file');
  });

  test('includes duration when success', () => {
    const line = toolLine('read_file', { path: '/test' }, true, 123);
    expect(line).toContain('123ms');
  });

  test('includes duration when failure', () => {
    const line = toolLine('exec_command', { command: 'rm -rf /' }, false, 5);
    expect(line).toContain('5ms');
  });

  test('includes path in args summary', () => {
    const line = toolLine('read_file', { path: '/some/long/path/file.txt' }, true);
    expect(line).toContain('/some/long/path/file.txt');
  });

  test('includes command in args summary', () => {
    const line = toolLine('exec_command', { command: 'ls -la' }, true);
    expect(line).toContain('ls -la');
  });

  test('truncates long paths', () => {
    const longPath = '/very/long/' + 'x'.repeat(100);
    const line = toolLine('read_file', { path: longPath }, true);
    // Should contain truncated version with ...
    expect(line.length).toBeLessThan(longPath.length + 50);
  });

  test('truncates long commands', () => {
    const longCmd = 'echo ' + 'a'.repeat(100);
    const line = toolLine('exec_command', { command: longCmd }, true);
    expect(line.length).toBeLessThan(longCmd.length + 50);
  });

  test('handles empty args', () => {
    const line = toolLine('some_tool', {}, true);
    expect(line).toContain('some_tool');
  });

  test('handles string arg values', () => {
    const line = toolLine('some_tool', { value: 'hello world' }, true);
    expect(line).toContain('hello world');
  });
});

describe('renderHeaderBox', () => {
  test('renders header box with provider info', () => {
    const box = renderHeaderBox({
      provider: 'Anthropic',
      model: 'claude-3',
      endpoint: 'https://api.anthropic.com',
      status: 'ready',
      version: '0.1.0',
    });
    expect(box).toContain('Provider');
    expect(box).toContain('Anthropic');
    expect(box).toContain('Model');
    expect(box).toContain('claude-3');
    expect(box).toContain('Endpoint');
  });

  test('renders double-line box borders', () => {
    const box = renderHeaderBox({
      provider: 'Test',
      model: 'test-model',
      endpoint: 'http://localhost',
      status: 'ready',
      version: '1.0',
    });
    expect(box).toContain('╔');
    expect(box).toContain('╗');
    expect(box).toContain('╚');
    expect(box).toContain('╝');
    expect(box).toContain('╠');
    expect(box).toContain('╣');
  });

  test('truncates long endpoints', () => {
    const longEndpoint = 'https://' + 'a'.repeat(100) + '.com';
    const box = renderHeaderBox({
      provider: 'Test',
      model: 'test',
      endpoint: longEndpoint,
      status: 'ready',
      version: '1.0',
    });
    expect(box).toContain('...');
  });

  test('shows ready status', () => {
    const box = renderHeaderBox({
      provider: 'Test',
      model: 'test',
      endpoint: 'http://localhost',
      status: 'ready',
      version: '1.0',
    });
    expect(box).toContain('Ready');
  });

  test('shows loading status', () => {
    const box = renderHeaderBox({
      provider: 'Test',
      model: 'test',
      endpoint: 'http://localhost',
      status: 'loading',
      statusText: 'Initializing...',
      version: '1.0',
    });
    expect(box).toContain('Initializing');
  });
});

describe('renderPromptSeparator', () => {
  test('renders separator with prompt', () => {
    const sep = renderPromptSeparator();
    expect(sep).toContain('❯');
    expect(sep).toContain('─');
  });

  test('includes mode text when provided', () => {
    const sep = renderPromptSeparator('plan mode on');
    expect(sep).toContain('[plan mode on]');
  });
});

describe('renderFooterBar', () => {
  test('renders shortcuts hint', () => {
    const footer = renderFooterBar();
    expect(footer).toContain('? for shortcuts');
  });

  test('includes file context when provided', () => {
    const footer = renderFooterBar('test.ts');
    expect(footer).toContain('In');
    expect(footer).toContain('test.ts');
  });

  test('includes effort when provided', () => {
    const footer = renderFooterBar(undefined, 'high');
    expect(footer).toContain('high');
  });
});
