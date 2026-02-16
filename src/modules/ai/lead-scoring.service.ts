import { prisma } from '../../lib/prisma';
import { AI_CONFIG } from './ai.config';
import { LeadTier, Channel } from '@prisma/client';

export interface LeadScoreFactors {
  engagement: {
    emailOpens: number;
    emailClicks: number;
    messageReplies: number;
    websiteVisits: number;
    formSubmissions: number;
  };
  demographic: {
    phoneVerified: boolean;
    emailVerified: boolean;
    profileComplete: boolean;
  };
  recency: {
    lastActivityDays: number;
  };
}

export interface LeadScoreResult {
  overallScore: number;
  engagementScore: number;
  intentScore: number;
  demographicScore: number;
  tier: LeadTier;
  factors: LeadScoreFactors;
  recommendations: string[];
}

class LeadScoringService {
  // ==================== SCORE CALCULATION ====================

  async calculateScore(userId: string, contactId: string): Promise<LeadScoreResult> {
    // Get contact activity data
    const [contact, messages, conversations] = await Promise.all([
      prisma.contact.findFirst({
        where: { id: contactId, userId },
        include: { leadScore: true },
      }),
      prisma.message.findMany({
        where: { contactId },
      }),
      prisma.conversation.findMany({
        where: { contactId },
        include: { messages: true },
      }),
    ]);

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Calculate engagement metrics
    const factors = this.extractFactors(contact, messages, conversations);
    
    // Calculate scores
    const engagementScore = this.calculateEngagementScore(factors.engagement);
    const demographicScore = this.calculateDemographicScore(factors.demographic);
    const recencyScore = this.calculateRecencyScore(factors.recency);
    
    // Calculate intent score based on AI analysis of recent interactions
    const intentScore = await this.calculateIntentScore(contactId, conversations);
    
    // Calculate overall score with weighting
    const overallScore = Math.min(100, Math.round(
      engagementScore * 0.4 +
      intentScore * 0.35 +
      demographicScore * 0.15 +
      recencyScore * 0.10
    ));

    // Determine tier
    const tier = this.getTierFromScore(overallScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, overallScore, tier);

    // Save/update score
    await this.saveScore(userId, contactId, {
      overallScore,
      engagementScore,
      intentScore,
      demographicScore,
      tier,
      factors,
      recommendations,
    });

    return {
      overallScore,
      engagementScore,
      intentScore,
      demographicScore,
      tier,
      factors,
      recommendations,
    };
  }

  private extractFactors(
    contact: any,
    messages: any[],
    conversations: any[]
  ): LeadScoreFactors {
    const now = new Date();
    const lastActivity = contact.lastContactAt || contact.createdAt;
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    return {
      engagement: {
        emailOpens: messages.filter(m => m.channel === Channel.EMAIL && m.status === 'DELIVERED').length,
        emailClicks: 0, // Would need tracking
        messageReplies: messages.filter(m => m.replyReceived).length,
        websiteVisits: 0, // Would need web tracking
        formSubmissions: contact.source ? 1 : 0,
      },
      demographic: {
        phoneVerified: !!contact.phone,
        emailVerified: !!contact.email,
        profileComplete: !!(contact.name && contact.email && contact.phone),
      },
      recency: {
        lastActivityDays: daysSinceActivity,
      },
    };
  }

  private calculateEngagementScore(engagement: LeadScoreFactors['engagement']): number {
    const weights = AI_CONFIG.LEAD_SCORING.ENGAGEMENT;
    
    let score = 0;
    score += Math.min(engagement.emailOpens * weights.EMAIL_OPEN, 30);
    score += Math.min(engagement.emailClicks * weights.EMAIL_CLICK, 40);
    score += Math.min(engagement.messageReplies * weights.MESSAGE_REPLY, 60);
    score += Math.min(engagement.websiteVisits * weights.WEBSITE_VISIT, 45);
    score += engagement.formSubmissions * weights.FORM_SUBMIT;

    return Math.min(100, score);
  }

  private calculateDemographicScore(demographic: LeadScoreFactors['demographic']): number {
    const weights = AI_CONFIG.LEAD_SCORING.DEMOGRAPHIC;
    
    let score = 0;
    if (demographic.phoneVerified) score += weights.PHONE_VERIFIED;
    if (demographic.emailVerified) score += weights.EMAIL_VERIFIED;
    if (demographic.profileComplete) score += weights.PROFILE_COMPLETE;

    return score;
  }

  private calculateRecencyScore(recency: LeadScoreFactors['recency']): number {
    const days = recency.lastActivityDays;
    const decay = AI_CONFIG.LEAD_SCORING.DECAY;
    
    if (days > decay.MAX_AGE_DAYS) return 0;
    
    // Exponential decay
    const score = 100 * Math.exp(-(days * decay.DAILY) / 10);
    return Math.round(score);
  }

  private async calculateIntentScore(contactId: string, conversations: any[]): Promise<number> {
    if (conversations.length === 0) return 0;

    // Analyze recent messages for buying intent
    const recentMessages = conversations
      .flatMap(c => c.messages)
      .filter((m: any) => m.direction === 'INBOUND')
      .slice(-5);

    if (recentMessages.length === 0) return 10;

    // Simple keyword-based intent detection (could be enhanced with AI)
    const intentKeywords = {
      high: ['buy', 'purchase', 'price', 'cost', 'pay', 'checkout', 'order', 'interested in buying'],
      medium: ['demo', 'trial', 'sample', 'more info', 'details', 'features', 'comparison'],
      low: ['thanks', 'ok', 'not interested', 'maybe later', 'too expensive'],
    };

    let intentScore = 10; // Base score
    const messageText = recentMessages.map((m: any) => m.content.toLowerCase()).join(' ');

    for (const keyword of intentKeywords.high) {
      if (messageText.includes(keyword)) intentScore += 20;
    }
    for (const keyword of intentKeywords.medium) {
      if (messageText.includes(keyword)) intentScore += 10;
    }
    for (const keyword of intentKeywords.low) {
      if (messageText.includes(keyword)) intentScore -= 10;
    }

    return Math.max(0, Math.min(100, intentScore));
  }

  private getTierFromScore(score: number): LeadTier {
    if (score >= 80) return LeadTier.HOT;
    if (score >= 50) return LeadTier.WARM;
    if (score >= 25) return LeadTier.COLD;
    return LeadTier.COLD;
  }

  private generateRecommendations(
    factors: LeadScoreFactors,
    overallScore: number,
    tier: LeadTier
  ): string[] {
    const recommendations: string[] = [];

    if (tier === LeadTier.HOT) {
      recommendations.push('🔥 Hot lead - Prioritize immediate follow-up');
      recommendations.push('Consider offering a limited-time deal');
    } else if (tier === LeadTier.WARM) {
      recommendations.push('🌡️ Warm lead - Nurture with valuable content');
      if (factors.engagement.messageReplies === 0) {
        recommendations.push('Try a different channel or message angle');
      }
    } else {
      recommendations.push('❄️ Cold lead - Add to long-term nurture sequence');
      recommendations.push('Send educational content to build awareness');
    }

    if (factors.recency.lastActivityDays > 30) {
      recommendations.push(`No activity for ${factors.recency.lastActivityDays} days - Send re-engagement message`);
    }

    if (!factors.demographic.phoneVerified) {
      recommendations.push('Missing phone number - Add to data enrichment campaign');
    }

    if (factors.engagement.emailOpens > 5 && factors.engagement.emailClicks === 0) {
      recommendations.push('Opens emails but no clicks - Test different CTAs');
    }

    return recommendations;
  }

  private async saveScore(
    userId: string,
    contactId: string,
    score: Omit<LeadScoreResult, 'factors'> & { factors: LeadScoreFactors }
  ) {
    const data = {
      overallScore: score.overallScore,
      engagementScore: score.engagementScore,
      intentScore: score.intentScore,
      demographicScore: score.demographicScore,
      factors: JSON.stringify(score.factors),
      tier: score.tier,
      lastActivityAt: new Date(),
    };

    await prisma.leadScore.upsert({
      where: { contactId },
      create: {
        ...data,
        userId,
        contactId,
      },
      update: data,
    });

    // Update contact status to match tier
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        status: score.tier === 'HOT' ? 'ACTIVE' : score.tier === 'WARM' ? 'ACTIVE' : 'COLD',
      },
    });
  }

  // ==================== BULK OPERATIONS ====================

  async scoreAllLeads(userId: string): Promise<{ processed: number; errors: number }> {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      select: { id: true },
    });

    let processed = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        await this.calculateScore(userId, contact.id);
        processed++;
      } catch (error) {
        console.error(`Failed to score contact ${contact.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }

  async getScoredLeads(
    userId: string,
    options: {
      tier?: LeadTier;
      minScore?: number;
      maxScore?: number;
      limit?: number;
      offset?: number;
    }
  ) {
    const { tier, minScore, maxScore, limit = 50, offset = 0 } = options;

    const where: any = { userId };
    
    if (tier) {
      where.tier = tier;
    }
    
    if (minScore !== undefined || maxScore !== undefined) {
      where.overallScore = {};
      if (minScore !== undefined) where.overallScore.gte = minScore;
      if (maxScore !== undefined) where.overallScore.lte = maxScore;
    }

    const [scores, total] = await Promise.all([
      prisma.leadScore.findMany({
        where,
        include: {
          contact: true,
        },
        orderBy: { overallScore: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.leadScore.count({ where }),
    ]);

    return {
      leads: scores.map(s => ({
        ...s,
        factors: JSON.parse(s.factors as string),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  // ==================== ANALYTICS ====================

  async getScoreDistribution(userId: string) {
    const distribution = await prisma.leadScore.groupBy({
      by: ['tier'],
      where: { userId },
      _count: { tier: true },
    });

    return {
      hot: distribution.find(d => d.tier === 'HOT')?._count.tier || 0,
      warm: distribution.find(d => d.tier === 'WARM')?._count.tier || 0,
      cold: distribution.find(d => d.tier === 'COLD')?._count.tier || 0,
    };
  }

  async getHighValueLeads(userId: string, limit: number = 10) {
    return prisma.leadScore.findMany({
      where: { userId, overallScore: { gte: 70 } },
      include: { contact: true },
      orderBy: { overallScore: 'desc' },
      take: limit,
    });
  }
}

export const leadScoringService = new LeadScoringService();
