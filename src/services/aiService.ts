import { Wallet } from '../modules/wallets/model';
import { Transaction } from '../modules/transactions/model';
import { Category } from '../modules/categories/model';
import { logger } from '../common/utils/logger';
import { env } from '../common/config/env';

interface ParsedTransaction {
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryName?: string;
  note?: string;
  date?: string;
}

interface BudgetRecommendation {
  categoryName: string;
  amount: number;
  reason: string;
}

interface AIAdviceResponse {
  advice: string;
  insights: string[];
  actionItems: string[];
}

export class AIService {
  private static getApiKey(): string | null {
    return env.GEMINI_API_KEY || null;
  }

  private static async callGemini(prompt: string, expectJson = true): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const body: any = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    if (expectJson) {
      body.generationConfig = {
        responseMimeType: 'application/json'
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const resJson = (await response.json()) as any;
    const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error('Empty response from Gemini API');
    }

    if (expectJson) {
      return JSON.parse(textContent);
    }
    return textContent;
  }

  /**
   * Parse a natural language input into structured transaction parameters.
   */
  static async parseNaturalLanguageTransaction(userId: string, input: string): Promise<ParsedTransaction> {
    const categories = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
    const categoryNames = categories.map(c => c.name).join(', ');

    const prompt = `
      You are an expert financial assistant. Parse the following natural language input into a structured transaction JSON object.
      User input: "${input}"
      
      Available expense categories: [${categoryNames}]
      
      Return a JSON object conforming strictly to the following TypeScript interface:
      interface ParsedTransaction {
        name: string; // The merchant name, employer name, or destination/source name
        amount: number; // The decimal amount
        type: 'income' | 'expense' | 'transfer';
        categoryName?: string; // Must match one of the available categories if it fits, or suggest a standard category name
        note?: string; // Optional extra details
        date?: string; // ISO Date string (YYYY-MM-DD) if date is specified, e.g., "yesterday" or "last Friday", calculate it relative to today: ${new Date().toISOString().split('T')[0]}
      }
    `;

    try {
      if (!this.getApiKey()) throw new Error('No API Key');
      return await this.callGemini(prompt);
    } catch (err) {
      logger.warn('[AIService] Using fallback parser for transaction parsing:', err);
      return this.fallbackParseTransaction(input, categoryNames.split(', '));
    }
  }

  /**
   * Recommend custom budgets for user categories based on actual transaction patterns.
   */
  static async generateBudgetPlan(userId: string): Promise<BudgetRecommendation[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [transactions, categories, wallets] = await Promise.all([
      Transaction.find({ userId, date: { $gte: threeMonthsAgo } }).lean(),
      Category.find({ $or: [{ userId }, { isDefault: true }] }).lean(),
      Wallet.find({ userId }).lean()
    ]);

    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

    const prompt = `
      You are an elite financial planner. Analyze the user's recent transactions and categories to generate a personalized, smart monthly budget plan.
      
      User's Wallets Total Balance: $${totalBalance}
      Categories: ${JSON.stringify(categories.map(c => ({ id: c._id, name: c.name })))}
      Recent Transactions (last 3 months): ${JSON.stringify(transactions.map(t => ({ amount: t.amount, type: t.type, categoryId: t.categoryId, date: t.date, name: t.name })))}
      
      Return a JSON array of recommended budgets. Each item must conform strictly to:
      interface BudgetRecommendation {
        categoryName: string; // Must be one of the user's category names
        amount: number; // Recommended monthly budget amount in dollars
        reason: string; // 1-sentence reason explaining why based on their spending history
      }
    `;

    try {
      if (!this.getApiKey()) throw new Error('No API Key');
      return await this.callGemini(prompt);
    } catch (err) {
      logger.warn('[AIService] Using fallback for budget plan generation:', err);
      return this.fallbackBudgetPlan(categories, transactions);
    }
  }

  /**
   * Provide custom financial health insights and conversational advice.
   */
  static async getFinancialAdvice(userId: string, question?: string): Promise<AIAdviceResponse> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const [transactions, wallets] = await Promise.all([
      Transaction.find({ userId, date: { $gte: startOfMonth } }).lean(),
      Wallet.find({ userId }).lean()
    ]);

    const balance = wallets.reduce((s, w) => s + w.balance, 0);
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const prompt = `
      You are a brilliant financial coach. Review the user's summary data and answer their question or offer high-impact financial guidance.
      User Question/Context: "${question || 'Give me a general checkup and feedback on my finances.'}"
      
      Current Month Metrics:
      - Total Balance: $${balance}
      - Total Monthly Income: $${income}
      - Total Monthly Expenses: $${expenses}
      - Recent Transactions: ${JSON.stringify(transactions.slice(0, 10).map(t => ({ amount: t.amount, name: t.name, type: t.type })))}
      
      Return a JSON object conforming strictly to:
      interface AIAdviceResponse {
        advice: string; // The main advice/answer text (markdown supported, friendly tone, max 3 paragraphs)
        insights: string[]; // 3-4 bullet-point dynamic insights about their spending patterns
        actionItems: string[]; // 2-3 specific, actionable tasks they can do today to improve their financial health
      }
    `;

    try {
      if (!this.getApiKey()) throw new Error('No API Key');
      return await this.callGemini(prompt);
    } catch (err) {
      logger.warn('[AIService] Using fallback for financial advice:', err);
      return this.fallbackFinancialAdvice(balance, income, expenses);
    }
  }

  // Fallbacks
  private static fallbackParseTransaction(input: string, categories: string[]): ParsedTransaction {
    const text = input.toLowerCase();
    
    // Find amount
    const amountMatch = text.match(/\b\d+(\.\d{1,2})?\b/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;

    // Detect type
    let type: 'income' | 'expense' | 'transfer' = 'expense';
    if (text.includes('earned') || text.includes('salary') || text.includes('got paid') || text.includes('income')) {
      type = 'income';
    } else if (text.includes('transfer') || text.includes('moved')) {
      type = 'transfer';
    }

    // Try matching categories
    let categoryName = categories[0] || 'Uncategorized';
    for (const cat of categories) {
      if (text.includes(cat.toLowerCase())) {
        categoryName = cat;
        break;
      }
    }

    // Name detection (fallback to capital word or merchant)
    let name = 'Transaction';
    if (text.includes('at ')) {
      const idx = text.indexOf('at ') + 3;
      name = input.substring(idx).split(' ')[0];
    } else if (text.includes('for ')) {
      const idx = text.indexOf('for ') + 4;
      name = input.substring(idx).split(' ')[0];
    }

    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      amount,
      type,
      categoryName,
      date: new Date().toISOString().split('T')[0],
      note: `Parsed locally: "${input}"`
    };
  }

  private static fallbackBudgetPlan(categories: any[], transactions: any[]): BudgetRecommendation[] {
    const recs: BudgetRecommendation[] = [];
    categories.forEach(c => {
      const catTxns = transactions.filter(t => t.categoryId?.toString() === c._id.toString());
      const total = catTxns.reduce((s, t) => s + t.amount, 0);
      const monthlySpend = Math.max(50, Math.round(total / 3));

      recs.push({
        categoryName: c.name,
        amount: Math.round(monthlySpend * 1.1),
        reason: `Based on your recent average spending of $${monthlySpend}/mo, this budget gives you a 10% safety margin.`
      });
    });
    return recs;
  }

  private static fallbackFinancialAdvice(balance: number, income: number, expenses: number): AIAdviceResponse {
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    let advice = 'Your financial health looks stable. To build long-term wealth, try to keep a consistent savings rate above 20%.';
    const insights = [
      `Your current combined balance is $${balance.toLocaleString()}.`,
      `You spent $${expenses.toLocaleString()} this month against $${income.toLocaleString()} in income.`
    ];
    const actionItems = [
      'Review your recurring subscriptions to see if you can cut $20/month.',
      'Consider setting up an automated transfer of 10% of your income directly to your savings account.'
    ];

    if (savingsRate < 0) {
      advice = 'Your spending is currently outpacing your income this month. We recommend analyzing your non-essential expenses immediately to prevent building debt.';
      insights.push('You have a negative savings rate this month.');
      actionItems.unshift('Postpone any major optional purchases until next month.');
    } else if (savingsRate > 30) {
      advice = 'Incredible job! You have a high savings rate of over 30% this month. This is excellent for compounding your savings or paying down any debts.';
      insights.push(`Your savings rate is a fantastic ${savingsRate.toFixed(0)}%.`);
    }

    return { advice, insights, actionItems };
  }
}
