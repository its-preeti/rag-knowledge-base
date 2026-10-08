import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import OpenAI from 'openai';
import { Response } from 'express';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly config: ConfigService,
  ) {
    const groqApiKey = config.get<string>('GROQ_API_KEY');

    if (groqApiKey && groqApiKey !== 'your-groq-api-key') {
      this.openai = new OpenAI({
        apiKey: groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    } else {
      this.openai = new OpenAI({
        apiKey: config.get<string>('OPENAI_API_KEY'),
      });
    }
  }

  async createChat(
    userId: string,
    workspaceId: string,
    title?: string,
  ) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          some: { userId },
        },
      },
    });

    if (!workspace) {
      throw new ForbiddenException(
        'Workspace not found or access denied',
      );
    }

    const groqApiKey =
      this.config.get<string>('GROQ_API_KEY');

    const useGroq =
      !!groqApiKey &&
      groqApiKey !== 'your-groq-api-key';

    const model = useGroq
      ? this.config.get<string>(
          'GROQ_MODEL',
          'openai/gpt-oss-20b',
        )
      : this.config.get<string>(
          'OPENAI_MODEL',
          'gpt-4o',
        );

    return this.prisma.chat.create({
      data: {
        title: title || 'New Chat',
        userId,
        workspaceId,
        model,
        temperature: parseFloat(
          this.config.get<string>(
            'OPENAI_TEMPERATURE',
            '0.1',
          ),
        ),
        maxTokens: parseInt(
          this.config.get<string>(
            'OPENAI_MAX_TOKENS',
            '4096',
          ),
        ),
      },
    });
  }

  async findAllChats(
    userId: string,
    workspaceId: string,
    page = 1,
    limit = 20,
  ) {
    const pageNum =
      isNaN(Number(page)) || Number(page) < 1
        ? 1
        : Number(page);

    const limitNum =
      isNaN(Number(limit)) || Number(limit) < 1
        ? 20
        : Number(limit);

    const skip = (pageNum - 1) * limitNum;

    const [chats, total] = await Promise.all([
      this.prisma.chat.findMany({
        where: {
          userId,
          workspaceId,
          isArchived: false,
        },
        skip,
        take: limitNum,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              content: true,
              createdAt: true,
            },
          },
        },
      }),

      this.prisma.chat.count({
        where: {
          userId,
          workspaceId,
          isArchived: false,
        },
      }),
    ]);

    return {
      data: chats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(
          total / limit,
        ),
      },
    };
  }

  async findChatById(
    id: string,
    userId: string,
  ) {
    const chat =
      await this.prisma.chat.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              id: true,
              role: true,
              content: true,
              sources: true,
              tokensUsed: true,
              cost: true,
              createdAt: true,
            },
          },
        },
      });

    if (!chat) {
      throw new NotFoundException(
        'Chat not found',
      );
    }

    return chat;
  }

  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    res: Response,
    documentIds?: string[],
  ) {
    const chat =
      await this.prisma.chat.findFirst({
        where: {
          id: chatId,
          userId,
        },
      });

    if (!chat) {
      throw new NotFoundException(
        'Chat not found',
      );
    }

    // Save user message
    await this.prisma.message.create({
      data: {
        chatId,
        role: 'USER',
        content,
        documents: {
          connect: (documentIds || []).map(
            (id) => ({ id }),
          ),
        },
      },
    });

    // Retrieve relevant context from RAG
    const searchResults =
      await this.embeddings.searchSimilar(
        content,
        chat.workspaceId,
        {
          limit: 8,
          scoreThreshold: 0.25,
          documentIds:
            documentIds?.length
              ? documentIds
              : undefined,
        },
      );

    // Convert RAG results into text
    const contextText = searchResults
      .map((result) => {
        const documentName =
          result.documentName ||
          'Uploaded Document';

        const pageInfo =
          result.pageNumber
            ? `, Page ${result.pageNumber}`
            : '';

        return `[${documentName}${pageInfo}]\n${result.content}`;
      })
      .join('\n\n');

    const systemPrompt =
      this.buildSystemPrompt(
        contextText,
      );

    const messages =
      await this.buildMessageHistory(
        chatId,
        content,
      );

    // Select Groq or OpenAI
    const groqApiKey =
      this.config.get<string>(
        'GROQ_API_KEY',
      );

    const useGroq =
      !!groqApiKey &&
      groqApiKey !==
        'your-groq-api-key';

    const model = useGroq
      ? this.config.get<string>(
          'GROQ_MODEL',
          'openai/gpt-oss-20b',
        )
      : chat.model ||
        this.config.get<string>(
          'OPENAI_MODEL',
          'gpt-4o',
        );

    this.logger.log(
      `Using ${
        useGroq ? 'Groq' : 'OpenAI'
      } model: ${model}`,
    );

    // Detect if client accepts event-stream
    const clientAcceptsStream =
      res.req.headers['accept']?.includes(
        'text/event-stream',
      );

    // Non-streaming fallback
    if (!clientAcceptsStream) {
      try {
        const completion =
          await this.openai.chat.completions.create(
            {
              model,
              temperature:
                chat.temperature || 0.1,
              max_tokens:
                chat.maxTokens || 4096,
              stream: false,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                ...messages,
              ],
            },
          );

        const fullResponse =
          completion.choices[0]?.message
            ?.content || '';

        const totalTokens =
          completion.usage?.total_tokens ||
          0;

        const sources =
          searchResults.map((r) => ({
            documentId:
              r.documentId,
            documentName:
              r.documentName,
            pageNumber:
              r.pageNumber,
            score: r.score,
            excerpt:
              r.content.substring(0, 200),
          }));

        const cost =
          (totalTokens / 1000) * 0.005;

        const assistantMessage =
          await this.prisma.message.create(
            {
              data: {
                chatId,
                role: 'ASSISTANT',
                content: fullResponse,
                sources: sources as any,
                tokensUsed:
                  totalTokens,
                cost,
                model,
              },
            },
          );

        await this.prisma.chat.update({
          where: {
            id: chatId,
          },
          data: {
            totalTokens: {
              increment:
                totalTokens,
            },
            totalCost: {
              increment: cost,
            },
            updatedAt: new Date(),
            title:
              chat.title === 'New Chat'
                ? content.substring(
                    0,
                    60,
                  ) +
                  (content.length > 60
                    ? '...'
                    : '')
                : undefined,
          },
        });

        res.setHeader(
          'Content-Type',
          'application/json',
        );

        res.json({
          type: 'done',
          messageId:
            assistantMessage.id,
          content: fullResponse,
          sources,
          tokensUsed:
            totalTokens,
          cost,
        });

        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error);

        this.logger.error(
          `Non-streaming completion error: ${errorMessage}`,
        );

        res.status(500).json({
          error: errorMessage,
        });

        return;
      }
    }

    // Start SSE streaming
    res.setHeader(
      'Content-Type',
      'text/event-stream',
    );

    res.setHeader(
      'Cache-Control',
      'no-cache',
    );

    res.setHeader(
      'Connection',
      'keep-alive',
    );

    res.setHeader(
      'X-Accel-Buffering',
      'no',
    );

    let fullResponse = '';
    let totalTokens = 0;

    try {
      const stream =
        await this.openai.chat.completions.create(
          {
            model,
            temperature:
              chat.temperature || 0.1,
            max_tokens:
              chat.maxTokens || 4096,
            stream: true,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              ...messages,
            ],
          },
        );

      for await (const chunk of stream) {
        const delta =
          chunk.choices[0]?.delta
            ?.content || '';

        if (delta) {
          fullResponse += delta;

          res.write(
            `data: ${JSON.stringify({
              type: 'delta',
              content: delta,
            })}\n\n`,
          );
        }

        if (chunk.usage) {
          totalTokens =
            chunk.usage.total_tokens;
        }
      }

      // Format sources
      const sources =
        searchResults.map((r) => ({
          documentId:
            r.documentId,
          documentName:
            r.documentName,
          pageNumber:
            r.pageNumber,
          score: r.score,
          excerpt:
            r.content.substring(0, 200),
        }));

      // Estimate cost
      const cost =
        (totalTokens / 1000) * 0.005;

      // Save assistant message
      const assistantMessage =
        await this.prisma.message.create(
          {
            data: {
              chatId,
              role: 'ASSISTANT',
              content: fullResponse,
              sources: sources as any,
              tokensUsed:
                totalTokens,
              cost,
              model,
            },
          },
        );

      // Update chat stats
      await this.prisma.chat.update({
        where: {
          id: chatId,
        },
        data: {
          totalTokens: {
            increment:
              totalTokens,
          },
          totalCost: {
            increment: cost,
          },
          updatedAt: new Date(),
          title:
            chat.title === 'New Chat'
              ? content.substring(
                  0,
                  60,
                ) +
                (content.length > 60
                  ? '...'
                  : '')
              : undefined,
        },
      });

      // Log usage
      await this.prisma.usageLog.create({
        data: {
          userId,
          action:
            'chat_completion',
          model,
          tokensUsed:
            totalTokens,
          cost,
        },
      });

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId:
            assistantMessage.id,
          sources,
          tokensUsed:
            totalTokens,
          cost,
        })}\n\n`,
      );

      res.end();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `Streaming error: ${errorMessage}`,
      );

      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message:
            errorMessage,
        })}\n\n`,
      );

      res.end();
    }
  }

  private buildSystemPrompt(
    context: string,
  ): string {
    if (
      !context ||
      context.trim().length === 0
    ) {
      return `You are a helpful AI assistant for a knowledge base application.

You can answer both:
1. Questions about the user's uploaded documents.
2. General knowledge questions.

IMPORTANT RULES:

- If the user asks a general knowledge question, answer normally using your general knowledge.
- Do NOT say that information is missing from the uploaded documents for a general question.
- If the user asks specifically about an uploaded document, PDF, resume, or file, only use the uploaded document information.
- If the requested information is not present in the uploaded documents, say exactly:
"I couldn't find this information in your uploaded documents."
- Never create fake document citations.
- Never claim that general knowledge came from an uploaded document.
- For casual questions like hello, hi, how are you, or what can you do, respond naturally.
- Never make up facts.`;
    }

    return `You are a helpful AI assistant for a knowledge base application.

You have access to information retrieved from the user's uploaded documents.

IMPORTANT RULES:

1. Decide whether the user's question is about the uploaded documents or is a general knowledge question.

2. DOCUMENT QUESTIONS:
If the user asks about their uploaded documents, PDF, resume, or files:
- Use the uploaded document context as the PRIMARY source.
- Answer only from the provided document context.
- Do not use outside knowledge to fill missing information.
- Cite the relevant document and page number when available.
- If the requested information is not present in the document context, say exactly:
"I couldn't find this information in your uploaded documents."

3. GENERAL KNOWLEDGE QUESTIONS:
If the user's question is clearly general knowledge and is NOT asking about their documents:
- Answer using your general knowledge.
- Do NOT force the answer to come from the uploaded documents.
- Do NOT say "I couldn't find this information in your uploaded documents."
- Do NOT create a document citation for general knowledge.
- Answer naturally and accurately.

4. EXPLICIT DOCUMENT REQUESTS:
If the user says things like:
- "according to my document"
- "according to the PDF"
- "what does my document say"
- "what does the uploaded file say"
- "according to my resume"
- "in my uploaded document"

then ONLY use the uploaded document context.

If the answer is not present, say:
"I couldn't find this information in your uploaded documents."

5. CASUAL QUESTIONS:
For questions like:
- hello
- hi
- how are you?
- what can you do?
- good morning

respond naturally and helpfully.

6. NEVER:
- Do not invent facts.
- Do not create fake document citations.
- Do not claim general knowledge came from a document.

UPLOADED DOCUMENT CONTEXT:

${context}

DOCUMENT CITATION FORMAT:

[Document Name, Page X]

or:

[Document Name]

when a page number is not available.`;
  }

  private async buildMessageHistory(
    chatId: string,
    newContent: string,
  ) {
    const history =
      await this.prisma.message.findMany(
        {
          where: {
            chatId,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 20,
          select: {
            role: true,
            content: true,
          },
        },
      );

    const messages =
      history.map((m) => ({
        role: m.role.toLowerCase() as
          | 'user'
          | 'assistant',
        content: m.content,
      }));

    messages.push({
      role: 'user',
      content: newContent,
    });

    return messages;
  }

  async renameChat(
    id: string,
    userId: string,
    title: string,
  ) {
    const chat =
      await this.prisma.chat.findFirst({
        where: {
          id,
          userId,
        },
      });

    if (!chat) {
      throw new NotFoundException(
        'Chat not found',
      );
    }

    return this.prisma.chat.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });
  }

  async deleteChat(
    id: string,
    userId: string,
  ) {
    const chat =
      await this.prisma.chat.findFirst({
        where: {
          id,
          userId,
        },
      });

    if (!chat) {
      throw new NotFoundException(
        'Chat not found',
      );
    }

    await this.prisma.message.deleteMany({
      where: {
        chatId: id,
      },
    });

    await this.prisma.chat.delete({
      where: {
        id,
      },
    });

    return {
      message:
        'Chat deleted successfully',
    };
  }

  async regenerateLastResponse(
    chatId: string,
    userId: string,
    res: Response,
  ) {
    const chat =
      await this.prisma.chat.findFirst({
        where: {
          id: chatId,
          userId,
        },
      });

    if (!chat) {
      throw new NotFoundException(
        'Chat not found',
      );
    }

    const messages =
      await this.prisma.message.findMany(
        {
          where: {
            chatId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 2,
        },
      );

    if (messages.length < 2) {
      throw new NotFoundException(
        'Not enough messages to regenerate',
      );
    }

    const lastAssistant =
      messages[0];

    const lastUser =
      messages[1];

    // Delete last assistant message
    await this.prisma.message.delete({
      where: {
        id: lastAssistant.id,
      },
    });

    // Re-send
    await this.sendMessage(
      chatId,
      userId,
      lastUser.content,
      res,
    );
  }

  async exportChatToPdf(
    chatId: string,
    userId: string,
  ): Promise<Buffer> {
    const chat =
      await this.findChatById(
        chatId,
        userId,
      );

    const PDFDocument =
      require('pdfkit');

    const doc = new PDFDocument();

    const chunks: Buffer[] = [];

    return new Promise(
      (resolve, reject) => {
        doc.on(
          'data',
          (chunk: Buffer) =>
            chunks.push(chunk),
        );

        doc.on(
          'end',
          () =>
            resolve(
              Buffer.concat(chunks),
            ),
        );

        doc.on(
          'error',
          reject,
        );

        doc
          .fontSize(20)
          .text(chat.title, {
            align: 'center',
          });

        doc.moveDown();

        for (const message of (
          chat as any
        ).messages) {
          doc
            .fontSize(12)
            .fillColor(
              message.role === 'USER'
                ? '#1a73e8'
                : '#333',
            );

          doc.text(
            `${
              message.role === 'USER'
                ? 'You'
                : 'Assistant'
            }:`,
            {
              continued: false,
            },
          );

          doc
            .fontSize(11)
            .fillColor('#555')
            .text(
              message.content,
            );

          doc.moveDown();
        }

        doc.end();
      },
    );
  }

  async exportChatToMarkdown(
    chatId: string,
    userId: string,
  ): Promise<string> {
    const chat =
      await this.findChatById(
        chatId,
        userId,
      );

    let md =
      `# ${chat.title}\n\n`;

    md +=
      `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    for (const message of (
      chat as any
    ).messages) {
      const role =
        message.role === 'USER'
          ? '**You**'
          : '**Assistant**';

      md += `${role}:\n\n${message.content}\n\n---\n\n`;
    }

    return md;
  }
}