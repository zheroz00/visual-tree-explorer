import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

const MAX_LINE_LENGTH = 120;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export async function getFilePreview(filePath: string, lines: number): Promise<string[]> {
  const stats = await fs.stat(filePath);
  
  // For large files, use streaming
  if (stats.size > MAX_FILE_SIZE) {
    return getFilePreviewStream(filePath, lines);
  }
  
  // For smaller files, read directly
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileLines = content.split('\n');
    
    return fileLines
      .slice(0, lines)
      .map((line, index) => {
        const lineNum = index + 1;
        const truncated = line.length > MAX_LINE_LENGTH 
          ? line.substring(0, MAX_LINE_LENGTH) + '...'
          : line;
        return `${lineNum}: ${truncated}`;
      });
  } catch (error) {
    // Handle binary files or encoding errors
    if (error instanceof Error && error.message.includes('encoding')) {
      return ['[Binary file]'];
    }
    throw error;
  }
}

async function getFilePreviewStream(filePath: string, maxLines: number): Promise<string[]> {
  const preview: string[] = [];
  let lineCount = 0;
  let buffer = '';
  
  const lineExtractor = new Transform({
    transform(chunk, encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (lineCount >= maxLines) {
          this.push(null); // End the stream
          return callback();
        }
        
        lineCount++;
        const truncated = line.length > MAX_LINE_LENGTH
          ? line.substring(0, MAX_LINE_LENGTH) + '...'
          : line;
        preview.push(`${lineCount}: ${truncated}`);
      }
      
      callback();
    },
    
    flush(callback) {
      // Handle any remaining data in buffer
      if (buffer && lineCount < maxLines) {
        lineCount++;
        const truncated = buffer.length > MAX_LINE_LENGTH
          ? buffer.substring(0, MAX_LINE_LENGTH) + '...'
          : buffer;
        preview.push(`${lineCount}: ${truncated}`);
      }
      callback();
    }
  });
  
  try {
    const readStream = createReadStream(filePath, { 
      encoding: 'utf-8',
      highWaterMark: 1024 // Read in small chunks
    });
    
    await pipeline(readStream, lineExtractor);
  } catch (error) {
    // If it fails (e.g., binary file), return appropriate message
    if (preview.length === 0) {
      return ['[Binary or unreadable file]'];
    }
  }
  
  return preview;
}