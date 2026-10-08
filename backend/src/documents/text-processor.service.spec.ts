import { Test, TestingModule } from '@nestjs/testing';
import { TextProcessorService } from './text-processor.service';

describe('TextProcessorService', () => {
  let service: TextProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextProcessorService],
    }).compile();

    service = module.get<TextProcessorService>(TextProcessorService);
  });

  describe('cleanText', () => {
    it('should remove excessive whitespace', () => {
      const result = service.cleanText('Hello   World   Test');
      expect(result).toBe('Hello World Test');
    });

    it('should normalize line endings', () => {
      const result = service.cleanText('line1\r\nline2\rline3');
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should collapse multiple newlines', () => {
      const result = service.cleanText('paragraph1\n\n\n\nparagraph2');
      expect(result).toBe('paragraph1\n\nparagraph2');
    });
  });

  describe('splitIntoChunks', () => {
    it('should return empty array for empty text', () => {
      const result = service.splitIntoChunks('');
      expect(result).toHaveLength(0);
    });

    it('should return single chunk for short text', () => {
      const shortText = 'This is a short text.';
      const result = service.splitIntoChunks(shortText);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].content).toBeTruthy();
    });

    it('should split long text into multiple chunks', () => {
      const longText = Array(50).fill('This is a sentence that is somewhat long. ').join('');
      const result = service.splitIntoChunks(longText);
      expect(result.length).toBeGreaterThan(1);
    });

    it('should include chunkIndex in each chunk', () => {
      const text = Array(20).fill('Sentence here. ').join('');
      const result = service.splitIntoChunks(text);
      result.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i);
      });
    });

    it('should include startChar and endChar', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = service.splitIntoChunks(text);
      expect(result[0]).toHaveProperty('startChar');
      expect(result[0]).toHaveProperty('endChar');
    });
  });
});
