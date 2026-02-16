import { prisma } from '../../lib/prisma';
import { aiService } from './ai.service';
import { leadScoringService } from './lead-scoring.service';
import { dripCampaignService } from './drip-campaigns.service';
import { DripTrigger } from '@prisma/client';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select
}

export interface LeadCaptureSubmission {
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

class LeadCaptureService {
  // ==================== FORM MANAGEMENT ====================

  async createForm(userId: string, data: {
    name: string;
    title?: string;
    description?: string;
    fields: FormField[];
    aiEnabled?: boolean;
    aiPrompt?: string;
    primaryColor?: string;
    logoUrl?: string;
    webhookUrl?: string;
    redirectUrl?: string;
  }) {
    return prisma.leadCaptureForm.create({
      data: {
        userId,
        name: data.name,
        title: data.title || 'Get in Touch',
        description: data.description,
        fields: JSON.stringify(data.fields),
        aiEnabled: data.aiEnabled ?? true,
        aiPrompt: data.aiPrompt,
        primaryColor: data.primaryColor || '#0070f3',
        logoUrl: data.logoUrl,
        webhookUrl: data.webhookUrl,
        redirectUrl: data.redirectUrl,
      },
    });
  }

  async updateForm(userId: string, formId: string, data: Partial<{
    name: string;
    title: string;
    description: string;
    fields: FormField[];
    aiEnabled: boolean;
    aiPrompt: string;
    primaryColor: string;
    logoUrl: string;
    webhookUrl: string;
    redirectUrl: string;
  }>) {
    const form = await prisma.leadCaptureForm.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    const updateData: any = { ...data };
    if (data.fields) {
      updateData.fields = JSON.stringify(data.fields);
    }

    return prisma.leadCaptureForm.update({
      where: { id: formId },
      data: updateData,
    });
  }

  async deleteForm(userId: string, formId: string) {
    const form = await prisma.leadCaptureForm.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    return prisma.leadCaptureForm.delete({
      where: { id: formId },
    });
  }

  async getForms(userId: string) {
    return prisma.leadCaptureForm.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForm(userId: string, formId: string) {
    const form = await prisma.leadCaptureForm.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    return {
      ...form,
      fields: JSON.parse(form.fields as string),
    };
  }

  async getPublicForm(formId: string) {
    const form = await prisma.leadCaptureForm.findUnique({
      where: { id: formId },
      include: {
        user: {
          select: {
            name: true,
            whiteLabel: {
              select: {
                brandName: true,
                logoUrl: true,
                primaryColor: true,
              },
            },
          },
        },
      },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    return {
      id: form.id,
      title: form.title,
      description: form.description,
      fields: JSON.parse(form.fields as string),
      primaryColor: form.primaryColor,
      logoUrl: form.logoUrl || form.user?.whiteLabel?.logoUrl,
      brandName: form.user?.whiteLabel?.brandName || form.user?.name || 'BeeCastly',
    };
  }

  // ==================== FORM SUBMISSION ====================

  async submitForm(
    formId: string,
    submission: LeadCaptureSubmission,
    metadata?: {
      ip?: string;
      userAgent?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    }
  ) {
    const form = await prisma.leadCaptureForm.findUnique({
      where: { id: formId },
      include: { user: true },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    // Create or update contact
    const contact = await this.upsertContact(form.userId, submission);

    // Update form stats
    await prisma.leadCaptureForm.update({
      where: { id: formId },
      data: {
        submissions: { increment: 1 },
      },
    });

    // AI Qualification
    let qualification: any = null;
    if (form.aiEnabled) {
      qualification = await this.qualifyLead(form, submission);
      
      // Add qualification tags
      if (qualification.tags?.length) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            tags: {
              push: qualification.tags,
            },
          },
        });
      }
    }

    // Calculate lead score
    await leadScoringService.calculateScore(form.userId, contact.id);

    // Trigger drip campaigns
    await dripCampaignService.handleTrigger(
      form.userId,
      contact.id,
      DripTrigger.FORM_SUBMITTED,
      { formId, submission }
    );

    // Send webhook if configured
    if (form.webhookUrl) {
      await this.sendWebhook(form.webhookUrl, {
        formId,
        contact,
        submission,
        qualification,
        metadata,
      });
    }

    // Create analytics event
    await prisma.analyticsEvent.create({
      data: {
        userId: form.userId,
        eventType: 'lead_captured',
        contactId: contact.id,
        eventData: JSON.stringify({
          formId,
          source: metadata?.utmSource || 'direct',
          qualification: qualification?.score,
        }),
      },
    });

    return {
      success: true,
      contactId: contact.id,
      qualification,
      redirectUrl: form.redirectUrl,
    };
  }

  private async upsertContact(userId: string, submission: LeadCaptureSubmission) {
    const { email, phone, name, ...customFields } = submission;

    // Find existing contact by email or phone
    const existing = await prisma.contact.findFirst({
      where: {
        userId,
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    const data: any = {
      name: name || existing?.name,
      email: email || existing?.email,
      phone: phone || existing?.phone,
      source: 'lead_capture_form',
      metadata: JSON.stringify(customFields),
      lastContactAt: new Date(),
    };

    if (existing) {
      return prisma.contact.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.contact.create({
      data: {
        userId,
        ...data,
        status: 'ACTIVE',
      },
    });
  }

  // ==================== AI QUALIFICATION ====================

  private async qualifyLead(form: any, submission: LeadCaptureSubmission) {
    try {
      const prompt = `${form.aiPrompt || 'You are a lead qualification expert. Analyze this lead submission and provide insights.'}

Lead Information:
${JSON.stringify(submission, null, 2)}

Analyze and respond in this JSON format:
{
  "score": 0-100,
  "tier": "cold|warm|hot",
  "intent": "browsing|interested|ready_to_buy",
  "tags": ["tag1", "tag2"],
  "summary": "Brief qualification summary",
  "nextAction": "suggested next action",
  "questions": ["any follow-up questions to ask"]
}`;

      const response = await aiService.generateText(form.userId, prompt, {
        temperature: 0.5,
        maxTokens: 500,
      });

      const qualification = JSON.parse(response.content);
      
      return {
        ...qualification,
        aiTokensUsed: response.tokensUsed,
      };
    } catch (error) {
      console.error('AI Qualification failed:', error);
      return {
        score: 50,
        tier: 'warm',
        intent: 'interested',
        tags: ['form_submission'],
        summary: 'Lead captured via form',
        nextAction: 'Follow up within 24 hours',
        questions: [],
        error: true,
      };
    }
  }

  // ==================== FORM EMBED CODE ====================

  generateEmbedCode(formId: string): string {
    return `<!-- BeeCastly Lead Capture Form -->
<div id="becastly-form-${formId}"></div>
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${process.env.APP_URL}/api/embed/forms/${formId}';
  script.async = true;
  document.head.appendChild(script);
})();
</script>`;
  }

  generateIframeCode(formId: string): string {
    return `<iframe 
  src="${process.env.APP_URL}/forms/${formId}" 
  width="100%" 
  height="600" 
  frameborder="0"
  style="border: none;"
></iframe>`;
  }

  // ==================== WEBHOOK HANDLING ====================

  private async sendWebhook(url: string, data: any) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BeeCastly-Webhook': 'true',
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Webhook delivery failed:', error);
    }
  }

  // ==================== ANALYTICS ====================

  async getFormStats(userId: string, formId: string) {
    const form = await prisma.leadCaptureForm.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    // Get conversion data from analytics
    const submissions = await prisma.analyticsEvent.findMany({
      where: {
        userId,
        eventType: 'lead_captured',
        eventData: {
          contains: formId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Calculate conversion rate (would need page views tracking)
    const conversionRate = form.submissions > 0 
      ? Math.round((form.conversions / form.submissions) * 100) 
      : 0;

    return {
      totalSubmissions: form.submissions,
      conversions: form.conversions,
      conversionRate,
      recentSubmissions: submissions.length,
      qualifiedLeads: submissions.filter(s => {
        const data = JSON.parse(s.eventData as string);
        return data.qualification >= 70;
      }).length,
    };
  }

  async getAllFormsStats(userId: string) {
    const forms = await prisma.leadCaptureForm.findMany({
      where: { userId },
    });

    return forms.map(form => ({
      id: form.id,
      name: form.name,
      submissions: form.submissions,
      conversions: form.conversions,
      conversionRate: form.submissions > 0 
        ? Math.round((form.conversions / form.submissions) * 100) 
        : 0,
    }));
  }
}

export const leadCaptureService = new LeadCaptureService();
