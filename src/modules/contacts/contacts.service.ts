import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const contactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  telegramId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const importContactsSchema = z.object({
  tags: z.array(z.string()).default([]),
});

export type ContactInput = z.infer<typeof contactSchema>;

export async function getContacts(userId: string, options: {
  search?: string;
  tags?: string[];
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { search, tags, status, page = 1, limit = 50 } = options;

  const where: any = { userId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  if (status) {
    where.status = status;
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: 'desc' },
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    contacts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createContact(userId: string, data: ContactInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Check for duplicates by email or phone
  if (data.email || data.phone) {
    const existing = await prisma.contact.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new Error('Contact with this email or phone already exists');
    }
  }

  return prisma.contact.create({
    data: {
      tenantId: user.tenantId,
      userId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      telegramId: data.telegramId,
      tags: data.tags,
    },
  });
}

export async function updateContact(userId: string, contactId: string, data: Partial<ContactInput>) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  return prisma.contact.update({
    where: { id: contactId },
    data,
  });
}

export async function deleteContact(userId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  await prisma.contact.delete({
    where: { id: contactId },
  });

  return { success: true };
}

export async function importContactsFromCSV(
  userId: string,
  fileBuffer: Buffer,
  tags: string[] = []
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  const csvText = fileBuffer.toString('utf-8');
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return processImportData(userId, result.data as any[], tags);
}

export async function importContactsFromExcel(
  userId: string,
  fileBuffer: Buffer,
  tags: string[] = []
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return processImportData(userId, data as any[], tags);
}

async function processImportData(
  userId: string,
  data: any[],
  tags: string[]
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }
  const errors: string[] = [];
  let imported = 0;
  let duplicates = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    try {
      // Normalize field names
      const contactData = {
        name: row.name || row.Name || row.NAME || row.fullName || row.FullName || '',
        phone: row.phone || row.Phone || row.PHONE || row.phoneNumber || row.PhoneNumber || '',
        email: row.email || row.Email || row.EMAIL || row.emailAddress || row.EmailAddress || '',
        telegramId: row.telegramId || row.TelegramId || row.telegram || row.Telegram || '',
        tags: [...tags],
      };

      // Skip if no contact info
      if (!contactData.phone && !contactData.email && !contactData.telegramId) {
        errors.push(`Row ${i + 1}: No contact information provided`);
        continue;
      }

      // Check for duplicates
      const existing = await prisma.contact.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            ...(contactData.email ? [{ email: contactData.email }] : []),
            ...(contactData.phone ? [{ phone: contactData.phone }] : []),
          ],
        },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          userId,
          ...contactData,
        },
      });

      imported++;
    } catch (error: any) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  return { imported, duplicates, errors };
}

export async function getContactStats(userId: string) {
  const [total, active, unsubscribed, bounced] = await Promise.all([
    prisma.contact.count({ where: { userId } }),
    prisma.contact.count({ where: { userId, status: 'ACTIVE' } }),
    prisma.contact.count({ where: { userId, status: 'UNSUBSCRIBED' } }),
    prisma.contact.count({ where: { userId, status: 'BOUNCED' } }),
  ]);

  return { total, active, unsubscribed, bounced };
}
