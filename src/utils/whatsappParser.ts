import { parse, isValid } from 'date-fns';

export interface ChatMessage {
  timestamp: Date;
  sender: string;
  content: string;
  id: string;
}

export function parseWhatsAppChat(text: string): ChatMessage[] {
  console.log("Parsing chat text, length:", text.length);
  const lines = text.split('\n');
  const messages: ChatMessage[] = [];

  // More robust regex to handle various formats
  // 1. [28/02/2024, 14:30:05] Sender: Message
  // 2. 28/02/2024, 14:30 - Sender: Message
  // 3. 2/28/24, 2:30 PM - Sender: Message
  // 4. 28.02.24, 14:30 - Sender: Message

  // This regex looks for a date at the start of the line, followed by a sender and a colon
  const regex = /^\[?(\d{1,4}[./-]\d{1,4}[./-]\d{2,4},?\s\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]?\s?(?:-\s)?([^:]+):\s(.*)$/;

  let currentMessage: ChatMessage | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(regex);

    if (match) {
      const dateStr = match[1];
      const sender = match[2];
      const content = match[3];

      // Flexible date parsing
      let timestamp: Date | null = null;

      // Try native Date first for common formats
      const cleanDateStr = dateStr.replace('[', '').replace(']', '').replace(',', '').replace(/\u202F/g, ' ');
      const nativeDate = new Date(cleanDateStr);
      if (isValid(nativeDate)) {
        timestamp = nativeDate;
      } else {
        // Fallback to date-fns for specific formats
        const formats = [
          'dd/MM/yyyy HH:mm:ss',
          'dd/MM/yy HH:mm:ss',
          'dd/MM/yyyy HH:mm',
          'dd/MM/yy HH:mm',
          'MM/dd/yyyy HH:mm:ss',
          'MM/dd/yy HH:mm:ss',
          'd/M/yy HH:mm',
          'dd.MM.yy HH:mm',
          'yyyy-MM-dd HH:mm',
          // 12-hour formats
          'dd/MM/yyyy h:mm:ss a',
          'dd/MM/yyyy h:mm:ss aa',
          'MM/dd/yyyy h:mm:ss a',
          'MM/dd/yyyy h:mm:ss aa',
          'M/d/yyyy h:mm:ss a',
          'd/M/yyyy h:mm:ss a',
          'M/d/yy h:mm:ss a',
          'd/M/yy h:mm:ss a',
          'M/d/yy h:mm a',
          'd/M/yy h:mm a'
        ];

        for (const fmt of formats) {
          const d = parse(cleanDateStr, fmt, new Date());
          if (isValid(d)) {
            timestamp = d;
            break;
          }
        }
      }

      if (timestamp && sender && content) {
        currentMessage = {
          timestamp,
          sender: sender.trim(),
          content: content.trim(),
          id: Math.random().toString(36).substr(2, 9)
        };
        messages.push(currentMessage);
      } else {
        // If we matched the regex but couldn't parse the date, 
        // it might be a continuation or a system message
        if (currentMessage) {
          currentMessage.content += '\n' + line;
        }
      }
    } else if (currentMessage) {
      // It's a continuation of the previous message
      currentMessage.content += '\n' + line;
    }
  }

  console.log("Parsed messages count:", messages.length);
  return messages;
}
