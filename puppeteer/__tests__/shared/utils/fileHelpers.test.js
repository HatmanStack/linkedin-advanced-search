import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    appendFile: vi.fn(),
    readFileSync: vi.fn(),
  },
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  appendFile: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}));

vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileHelpers', () => {
  let FileHelpers;
  let mockFs;

  beforeEach(async () => {
    vi.resetModules();
    mockFs = await import('fs/promises');
    const module = await import('../../../src/shared/utils/fileHelpers.js');
    FileHelpers = module.FileHelpers;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it exists', async () => {
      mockFs.default.access.mockResolvedValue(undefined);

      await FileHelpers.ensureDirectoryExists('/test/dir');

      expect(mockFs.default.access).toHaveBeenCalledWith('/test/dir');
      expect(mockFs.default.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      mockFs.default.access.mockRejectedValue(error);
      mockFs.default.mkdir.mockResolvedValue(undefined);

      await FileHelpers.ensureDirectoryExists('/test/new-dir');

      expect(mockFs.default.mkdir).toHaveBeenCalledWith('/test/new-dir', { recursive: true });
    });

    it('should throw on non-ENOENT errors', async () => {
      const error = new Error('EACCES');
      error.code = 'EACCES';
      mockFs.default.access.mockRejectedValue(error);

      await expect(FileHelpers.ensureDirectoryExists('/test/dir')).rejects.toThrow('EACCES');
    });
  });

  describe('writeJSON', () => {
    it('should write JSON to file', async () => {
      mockFs.default.access.mockResolvedValue(undefined);
      mockFs.default.writeFile.mockResolvedValue(undefined);

      const data = { key: 'value' };
      await FileHelpers.writeJSON('/test/file.json', data);

      expect(mockFs.default.writeFile).toHaveBeenCalledWith(
        '/test/file.json',
        JSON.stringify(data, null, 2)
      );
    });

    it('should ensure directory exists before writing', async () => {
      const enoentError = new Error('ENOENT');
      enoentError.code = 'ENOENT';
      mockFs.default.access.mockRejectedValue(enoentError);
      mockFs.default.mkdir.mockResolvedValue(undefined);
      mockFs.default.writeFile.mockResolvedValue(undefined);

      await FileHelpers.writeJSON('/test/dir/file.json', { key: 'value' });

      expect(mockFs.default.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should throw on write errors', async () => {
      mockFs.default.access.mockResolvedValue(undefined);
      mockFs.default.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(FileHelpers.writeJSON('/test/file.json', {})).rejects.toThrow('Write error');
    });
  });

  describe('readJSON', () => {
    it('should read and parse JSON file', async () => {
      const data = { key: 'value' };
      mockFs.default.readFile.mockResolvedValue(JSON.stringify(data));

      const result = await FileHelpers.readJSON('/test/file.json');

      expect(result).toEqual(data);
      expect(mockFs.default.readFile).toHaveBeenCalledWith('/test/file.json', 'utf8');
    });

    it('should return null for non-existent file', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      mockFs.default.readFile.mockRejectedValue(error);

      const result = await FileHelpers.readJSON('/test/nonexistent.json');

      expect(result).toBeNull();
    });

    it('should throw on read errors other than ENOENT', async () => {
      const error = new Error('EACCES');
      error.code = 'EACCES';
      mockFs.default.readFile.mockRejectedValue(error);

      await expect(FileHelpers.readJSON('/test/file.json')).rejects.toThrow('EACCES');
    });

    it('should throw on invalid JSON', async () => {
      mockFs.default.readFile.mockResolvedValue('invalid json');

      await expect(FileHelpers.readJSON('/test/file.json')).rejects.toThrow();
    });
  });

  describe('appendToFile', () => {
    it('should append data to file', async () => {
      mockFs.default.access.mockResolvedValue(undefined);
      mockFs.default.appendFile.mockResolvedValue(undefined);

      await FileHelpers.appendToFile('/test/file.txt', 'new data');

      expect(mockFs.default.appendFile).toHaveBeenCalledWith('/test/file.txt', 'new data');
    });

    it('should ensure directory exists before appending', async () => {
      const enoentError = new Error('ENOENT');
      enoentError.code = 'ENOENT';
      mockFs.default.access.mockRejectedValue(enoentError);
      mockFs.default.mkdir.mockResolvedValue(undefined);
      mockFs.default.appendFile.mockResolvedValue(undefined);

      await FileHelpers.appendToFile('/test/dir/file.txt', 'data');

      expect(mockFs.default.mkdir).toHaveBeenCalled();
    });

    it('should throw on append errors', async () => {
      mockFs.default.access.mockResolvedValue(undefined);
      mockFs.default.appendFile.mockRejectedValue(new Error('Append error'));

      await expect(FileHelpers.appendToFile('/test/file.txt', 'data')).rejects.toThrow('Append error');
    });
  });
});
