import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { TextData } from '../types';


const TEXTS_FILE_PATH = path.join(__dirname, '../utils/text.json');


export class TextService {
  private data: TextData;

  constructor() {
    this.data = this.loadTexts();
  }

 
  private loadTexts(): TextData {
    try {
      if (fs.existsSync(TEXTS_FILE_PATH)) {
        const fileContent = fs.readFileSync(TEXTS_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent) as TextData;
      }
    } catch (error) {
      logger.error('Error loading texts from file', { error });
    }
    return { texts: [], longTexts: [] }; 
  }


  private saveTexts(): void {
    try {
      fs.writeFileSync(TEXTS_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Error saving texts to file', { error });
    }
  }

  /**
   * Get a random text for the typing race.
   * @param longText Whether to use a longer text for more challenge.
   */
  public getRandomText(longText: boolean = false): string {
    try {
      const textArray = longText ? this.data.longTexts : this.data.texts;

      if (textArray.length === 0) {
        throw new Error('No texts available.');
      }

      const randomIndex = Math.floor(Math.random() * textArray.length);
      const selectedText = textArray[randomIndex];

      logger.debug('Selected random text', { index: randomIndex, length: selectedText.length });
      return selectedText;
    } catch (error) {
      logger.error('Error getting random text', { error });
      return 'The quick brown fox jumps over the lazy dog.';
    }
  }

  /**
   * Get a specific text by index.
   * @param index The index of the text to retrieve.
   * @param longText Whether to use a longer text.
   */
  public getTextByIndex(index: number, longText: boolean = false): string {
    const textArray = longText ? this.data.longTexts : this.data.texts;

    if (index < 0 || index >= textArray.length) {
      throw new Error(`Invalid index: ${index}`);
    }

    return textArray[index];
  }

  /**
   * Add a new text to the collection.
   * @param text The text to add.
   * @param longText Whether to add it to the long texts collection.
   */
  public addText(text: string, longText: boolean = false): void {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (longText) {
      this.data.longTexts.push(text);
    } else {
      this.data.texts.push(text);
    }

    logger.info('Added new text', { longText, length: text.length });

    this.saveTexts(); 
  }
}
