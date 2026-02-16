import { FastifyInstance } from 'fastify';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  importContactsFromCSV,
  importContactsFromExcel,
  getContactStats,
  contactSchema,
  importContactsSchema,
} from './contacts.service';

export async function contactsRoutes(fastify: FastifyInstance) {
  // Get all contacts
  fastify.get('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { search, tags, status, page, limit } = request.query as any;

    try {
      const result = await getContacts(userId, {
        search,
        tags: tags ? tags.split(',') : undefined,
        status,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
      });

      return reply.send({ success: true, ...result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Get contact stats
  fastify.get('/stats', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const stats = await getContactStats(userId);
      return reply.send({ success: true, stats });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Create contact
  fastify.post('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = contactSchema.parse(request.body);
      const contact = await createContact(userId, data);
      return reply.code(201).send({ success: true, contact });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Update contact
  fastify.put('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const data = contactSchema.partial().parse(request.body);
      const contact = await updateContact(userId, id, data);
      return reply.send({ success: true, contact });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Delete contact
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      await deleteContact(userId, id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Import contacts from CSV/Excel
  fastify.post('/import', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ success: false, error: 'No file provided' });
      }

      const fileBuffer = await data.toBuffer();
      const { tags } = importContactsSchema.parse(request.body || {});

      const filename = data.filename.toLowerCase();
      let result;

      if (filename.endsWith('.csv')) {
        result = await importContactsFromCSV(userId, fileBuffer, tags);
      } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        result = await importContactsFromExcel(userId, fileBuffer, tags);
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Invalid file format. Supported formats: CSV, Excel (.xlsx, .xls)',
        });
      }

      return reply.send({
        success: true,
        message: `Import completed: ${result.imported} imported, ${result.duplicates} duplicates skipped`,
        details: result,
      });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
}
